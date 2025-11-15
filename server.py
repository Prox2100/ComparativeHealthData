#!/usr/bin/env python3
"""
HTTP server optimized for serving large files with proper timeout handling
"""
import http.server
import socketserver
import os
import sys

class LargeFileHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP request handler optimized for large files"""

    protocol_version = 'HTTP/1.1'

    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        # Enable caching for data files (1 hour)
        if self.path.endswith('.json') or self.path.endswith('.gz'):
            self.send_header('Cache-Control', 'public, max-age=3600')
        else:
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        # For .gz files, set proper content type
        if self.path.endswith('.gz'):
            self.send_header('Content-Type', 'application/gzip')
        super().end_headers()

    def copyfile(self, source, outputfile):
        """Override to handle large files with better error handling"""
        try:
            # Use larger buffer for faster transfer
            buffer_size = 256 * 1024  # 256KB chunks
            total_sent = 0
            while True:
                buf = source.read(buffer_size)
                if not buf:
                    break
                try:
                    outputfile.write(buf)
                    total_sent += len(buf)
                    # Log progress every 50MB
                    if total_sent % (50 * 1024 * 1024) == 0:
                        print(f"Sent {total_sent // (1024*1024)}MB...", file=sys.stderr, flush=True)
                except (BrokenPipeError, ConnectionResetError, OSError) as e:
                    print(f"Connection lost after {total_sent // (1024*1024)}MB: {e}", file=sys.stderr)
                    return
            print(f"Transfer complete: {total_sent // (1024*1024)}MB", file=sys.stderr, flush=True)
        except Exception as e:
            print(f"Error copying file: {e}", file=sys.stderr)
            raise

    def log_message(self, format, *args):
        """Override to suppress broken pipe error messages"""
        if "code 200" in str(args):
            # Only log successful responses for large files
            sys.stderr.write("%s - - [%s] %s\n" %
                           (self.address_string(),
                            self.log_date_time_string(),
                            format%args))

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    """Threaded server to handle multiple connections"""
    allow_reuse_address = True
    # Increase timeout for large file transfers
    timeout = 600  # 10 minutes
    request_queue_size = 10

PORT = 8000
Handler = LargeFileHTTPRequestHandler

# Change to the web app directory
os.chdir('/Users/brianprokop/Desktop/Projects/Comparative Health Data/web-app')

print(f"Starting server at http://localhost:{PORT}/")
print(f"Serving directory: {os.getcwd()}")
print(f"Large file support: Enabled (300s timeout, 64KB chunks)")
print("Press Ctrl+C to stop\n")

with ThreadedTCPServer(("", PORT), Handler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        sys.exit(0)
