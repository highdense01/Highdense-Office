// Ensures the local XAMPP MySQL server is running before `next dev` starts.
// The app's auth (NextAuth + Prisma) queries the database on every sign-in
// attempt; if MySQL is down, sign-in fails with a generic "Configuration"
// error that looks like a misconfigured OAuth/credentials setup.
const net = require("net");
const { spawn } = require("child_process");
const path = require("path");

const HOST = "127.0.0.1";
const PORT = 3306;
const XAMPP_MYSQL_START = "C:\\xampp\\mysql_start.bat";
const fs = require("fs");

function isPortOpen(host, port, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const onDone = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => onDone(true));
    socket.once("timeout", () => onDone(false));
    socket.once("error", () => onDone(false));
    socket.connect(port, host);
  });
}

async function waitForPort(host, port, attempts = 10, delayMs = 500) {
  for (let i = 0; i < attempts; i++) {
    if (await isPortOpen(host, port)) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

async function main() {
  if (await isPortOpen(HOST, PORT)) {
    console.log("[ensure-mysql] MySQL already running on :3306");
    return;
  }

  if (!fs.existsSync(XAMPP_MYSQL_START)) {
    console.warn(
      `[ensure-mysql] MySQL isn't running and ${XAMPP_MYSQL_START} wasn't found — start it manually (e.g. XAMPP Control Panel).`,
    );
    return;
  }

  console.log("[ensure-mysql] MySQL not running — starting XAMPP MySQL...");
  try {
    const child = spawn(XAMPP_MYSQL_START, [], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      shell: true,
      cwd: path.dirname(XAMPP_MYSQL_START),
    });
    child.on("error", (err) => {
      console.warn(`[ensure-mysql] Error starting MySQL: ${err.message}`);
    });
    child.unref();
  } catch (err) {
    console.warn(`[ensure-mysql] Could not launch ${XAMPP_MYSQL_START}: ${err.message}`);
  }

  const ready = await waitForPort(HOST, PORT);
  if (ready) {
    console.log("[ensure-mysql] MySQL is up.");
  } else {
    console.warn(
      "[ensure-mysql] MySQL still not reachable after waiting — check the XAMPP Control Panel for errors.",
    );
  }
}

main();
