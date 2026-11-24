#!/usr/local/bin/python3
"""Supervisor event listener: stop supervisord when a program goes FATAL.

supervisord gives up on a program after `startretries` failed starts and
leaves it FATAL while the container keeps running unhealthy. This listener
records the program name in /run/paper-fatal and SIGTERMs supervisord so
/deploy/start.sh can exit non-zero and the container restart policy recovers.

stdout is the supervisor protocol channel: only protocol tokens go there.
"""
import os
import signal
import sys

MARKER = "/run/paper-fatal"
PIDFILE = "/run/supervisord.pid"


def supervisord_pid():
    try:
        with open(PIDFILE) as f:
            return int(f.read().strip())
    except (OSError, ValueError):
        return os.getppid()


def handle_fatal(payload):
    fields = dict(p.split(":", 1) for p in payload.split() if ":" in p)
    name = fields.get("processname", "unknown")
    if os.path.exists(MARKER):
        return  # already shutting down
    try:
        with open(MARKER, "w") as f:
            f.write(name + "\n")
    except OSError as exc:
        sys.stderr.write("[fatal_exit] cannot write %s: %s\n" % (MARKER, type(exc).__name__))
    sys.stderr.write("[fatal_exit] %s entered FATAL; stopping supervisord\n" % name)
    sys.stderr.flush()
    try:
        os.kill(supervisord_pid(), signal.SIGTERM)
    except OSError:
        pass


def main():
    while True:
        sys.stdout.write("READY\n")
        sys.stdout.flush()
        line = sys.stdin.readline()
        if not line:
            return
        headers = dict(p.split(":", 1) for p in line.split() if ":" in p)
        try:
            length = int(headers["len"])
        except (KeyError, ValueError):
            return
        payload = sys.stdin.read(length)
        if headers.get("eventname") == "PROCESS_STATE_FATAL":
            handle_fatal(payload)
        sys.stdout.write("RESULT 2\nOK")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
