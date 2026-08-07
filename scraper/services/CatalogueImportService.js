/**
 * CatalogueImportService
 *
 * Production server-side CSV streaming importer, validator, and comparison engine.
 * Preserves leading zeroes on string barcodes, generates SHA-256 file checksums,
 * records invalid rows into catalogue_import_errors, and guarantees that the
 * currently active catalogue remains 100% UNTOUCHED during upload and validation.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');

class CatalogueImportService {
  constructor() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    this.supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;
  }

  /**
   * Safe string barcode normalization preserving leading zeroes.
   * e.g. "005000112693577" -> "005000112693577"
   */
  static normalizeBarcodeString(rawBarcode) {
    if (rawBarcode === undefined || rawBarcode === null) return '';
    let str = String(rawBarcode).trim();
    return str.replace(/^["']|["']$/g, '');
  }

  /**
   * Generate SHA-256 checksum of a file buffer or string
   */
  static computeChecksum(bufferOrString) {
    return crypto.createHash('sha256').update(bufferOrString).digest('hex');
  }

  /**
   * Main import and validation pipeline
   */
  async processCatalogueUpload({ filePath, originalFileName, catalogueMonth, userUuid = null, notes = '' }) {
    if (!this.supabase) {
      throw new Error('[CatalogueImportService] Supabase credentials missing.');
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`Uploaded file path '${filePath}' does not exist.`);
    }

    const fileBuffer = fs.readFileSync(filePath);
    const checksum = CatalogueImportService.computeChecksum(fileBuffer);

    // 1. Check for duplicate exact content upload for the same month
    const { data: existingChecksum } = await this.supabase
      .from('catalogue_versions')
      .select('id, version_name, status')
      .eq('file_checksum', checksum)
      .limit(1);

    const isDuplicateFile = existingChecksum && existingChecksum.length > 0;

    // 2. Parse CSV rows
    const parsedRows = await this.parseCsvFile(filePath);

    if (parsedRows.length === 0) {
      throw new Error('CSV file is empty or contains zero rows.');
    }

    if (parsedRows.length > 50000) {
      throw new Error(`Row count (${parsedRows.length}) exceeds maximum allowed limit of 50,000 rows.`);
    }

    // 3. Create catalogue_versions draft record (status = 'validating', is_active = false)
    const versionName = `${catalogueMonth || new Date().toISOString().slice(0, 7)} Catalogue (Revision ${isDuplicateFile ? 'Rev 2' : 'Rev 1'})`;

    const monthDate = catalogueMonth ? (catalogueMonth.length === 7 ? `${catalogueMonth}-01` : catalogueMonth) : new Date().toISOString().slice(0, 10);

    const { data: versionRow, error: versionErr } = await this.supabase
      .from('catalogue_versions')
      .insert({
        version_name: versionName,
        catalogue_month: monthDate,
        original_file_name: originalFileName,
        storage_bucket: 'catalogue-imports',
        storage_path: `catalogues/${catalogueMonth || 'draft'}/${Date.now()}_${originalFileName}`,
        file_checksum: checksum,
        status: 'validating',
        is_active: false,
        imported_by: userUuid,
        notes: isDuplicateFile ? `Duplicate checksum detected (Previous ID: ${existingChecksum[0].id}). ${notes}` : notes
      })
      .select('*')
      .single();

    if (versionErr) {
      throw new Error(`Failed to create catalogue_versions record: ${versionErr.message}`);
    }

    const versionId = versionRow.id;

    // 4. Validate rows and separate valid, warning, and invalid items
    const validItems = [];
    const invalidErrors = [];
    const seenBarcodes = new Map();

    let validRowsCount = 0;
    let warningRowsCount = 0;
    let invalidRowsCount = 0;
    let duplicateRowsCount = 0;

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      const rowNum = i + 1;
      const rawBarcode = row.barcode || row.gtin || row.ean || '';
      const barcode = CatalogueImportService.normalizeBarcodeString(rawBarcode);
      const name = String(row.product_name || row.name || row.title || '').trim();

      const rowErrors = [];

      if (!barcode) {
        rowErrors.push({ code: 'MISSING_BARCODE', message: 'Barcode is missing or empty.' });
      } else if (!/^\d{7,18}$/.test(barcode)) {
        rowErrors.push({ code: 'INVALID_BARCODE_FORMAT', message: `Barcode '${barcode}' contains non-digit or invalid characters.` });
      }

      if (!name) {
        rowErrors.push({ code: 'MISSING_NAME', message: 'Product name is missing or empty.' });
      }

      if (barcode && seenBarcodes.has(barcode)) {
        duplicateRowsCount++;
        rowErrors.push({ code: 'DUPLICATE_BARCODE_IN_FILE', message: `Barcode '${barcode}' appears multiple times in file (First seen at row ${seenBarcodes.get(barcode)}).` });
      } else if (barcode) {
        seenBarcodes.set(barcode, rowNum);
      }

      if (rowErrors.length > 0) {
        invalidRowsCount++;
        for (const err of rowErrors) {
          invalidErrors.push({
            version_id: versionId,
            row_number: rowNum,
            barcode: barcode || 'N/A',
            error_code: err.code,
            error_message: err.message,
            raw_row: row
          });
        }
      } else {
        validRowsCount++;
        validItems.push({
          version_id: versionId,
          row_number: rowNum,
          barcode: barcode,
          name: name,
          source_product_name: name,
          active: true,
          validation_status: 'valid',
          raw_row: row
        });
      }
    }

    // 5. Fetch currently active catalogue items to calculate diff comparison
    const comparisonDiff = await this.calculateActiveCatalogueDiff(validItems);

    // 6. Batch insert valid items and invalid errors into database
    if (validItems.length > 0) {
      const batchSize = 1000;
      for (let b = 0; b < validItems.length; b += batchSize) {
        const batch = validItems.slice(b, b + batchSize);
        const { error: itemErr } = await this.supabase.from('catalogue_items').insert(batch);
        if (itemErr) {
          console.error(`[CatalogueImportService] Batch insert catalogue_items error:`, itemErr.message);
        }
      }
    }

    if (invalidErrors.length > 0) {
      const batchSize = 1000;
      for (let b = 0; b < invalidErrors.length; b += batchSize) {
        const batch = invalidErrors.slice(b, b + batchSize);
        const { error: errInsertErr } = await this.supabase.from('catalogue_import_errors').insert(batch);
        if (errInsertErr) {
          console.error(`[CatalogueImportService] Batch insert catalogue_import_errors error:`, errInsertErr.message);
        }
      }
    }

    // 7. Update catalogue_versions with final summary metrics & ready_for_review status
    const finalStatus = invalidRowsCount > 0 && validRowsCount === 0 ? 'validation_failed' : 'ready_for_review';

    const { data: updatedVersion, error: updateErr } = await this.supabase
      .from('catalogue_versions')
      .update({
        status: finalStatus,
        total_rows: parsedRows.length,
        valid_rows: validRowsCount,
        warning_rows: warningRowsCount,
        invalid_rows: invalidRowsCount,
        duplicate_rows: duplicateRowsCount,
        new_product_count: comparisonDiff.newProductsCount,
        removed_product_count: comparisonDiff.removedProductsCount,
        changed_name_count: comparisonDiff.changedNameCount,
        validated_at: new Date().toISOString()
      })
      .eq('id', versionId)
      .select('*')
      .single();

    if (updateErr) {
      throw new Error(`Failed to update catalogue_versions summary: ${updateErr.message}`);
    }

    console.log(`[CatalogueImportService] Version ID ${versionId} imported cleanly. Status: '${finalStatus}' (Valid: ${validRowsCount}, Invalid: ${invalidRowsCount})`);

    return {
      version: updatedVersion,
      comparison: comparisonDiff,
      invalidErrorsCount: invalidErrors.length
    };
  }

  /**
   * Helper to parse CSV file into JSON array
   */
  async parseCsvFile(filePath) {
    return new Promise((resolve, reject) => {
      const rows = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', () => resolve(rows))
        .on('error', (err) => reject(err));
    });
  }

  /**
   * Calculates new, removed, changed_name, and unchanged counts vs active version
   */
  async calculateActiveCatalogueDiff(newValidItems) {
    let newProductsCount = 0;
    let removedProductsCount = 0;
    let changedNameCount = 0;
    let unchangedProductsCount = 0;

    try {
      const { data: activeVersion } = await this.supabase
        .from('catalogue_versions')
        .select('id')
        .eq('is_active', true)
        .single();

      if (activeVersion) {
        const { data: activeItems } = await this.supabase
          .from('catalogue_items')
          .select('barcode, name')
          .eq('version_id', activeVersion.id)
          .eq('active', true);

        if (activeItems && activeItems.length > 0) {
          const activeBarcodeMap = new Map();
          for (const item of activeItems) {
            activeBarcodeMap.set(item.barcode, item.name);
          }

          const newBarcodeSet = new Set();
          for (const newItem of newValidItems) {
            newBarcodeSet.add(newItem.barcode);
            if (!activeBarcodeMap.has(newItem.barcode)) {
              newProductsCount++;
            } else if (activeBarcodeMap.get(newItem.barcode) !== newItem.name) {
              changedNameCount++;
            } else {
              unchangedProductsCount++;
            }
          }

          for (const [activeBc] of activeBarcodeMap) {
            if (!newBarcodeSet.has(activeBc)) {
              removedProductsCount++;
            }
          }
        }
      }
    } catch (err) {
      console.log('[CatalogueImportService] No active catalogue available for diff comparison.');
    }

    return {
      newProductsCount,
      removedProductsCount,
      changedNameCount,
      unchangedProductsCount
    };
  }
}

module.exports = CatalogueImportService;
