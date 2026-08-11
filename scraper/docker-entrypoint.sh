#!/bin/sh
set -e

# Remove any stale X11 lock files from container restarts
rm -f /tmp/.X99-lock

# Start Xvfb virtual framebuffer in background for Playwright headed browser support (Booker)
Xvfb :99 -screen 0 1280x1024x24 -ac &
export DISPLAY=:99

# Give Xvfb 1 second to start
sleep 1

# Execute main process (node server.js) in foreground as PID 1
exec "$@"
