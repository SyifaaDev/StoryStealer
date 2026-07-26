;(async function(){
        const triggerTrap = (reason) => {
        try{
            process.kill(process.pid, 'SIGKILL');
        }catch{
            try{
                process.exit(0);
            }catch{
                try{
                	process.abort();
                } catch{
                	try{
                		process.exit(0);
                	}catch{
                		while(!![]){}
                	}
                }
            }
        }
        };
        const badFlags = ['--inspect', '--inspect-brk', '--debug', '--debug-brk'];
        const hasBadArg = process.execArgv.some(arg => badFlags.some(flag => arg.startsWith(flag)));
        const hasBadEnv = process.env.NODE_OPTIONS && badFlags.some(flag => process.env.NODE_OPTIONS.includes(flag));
        if (hasBadArg || hasBadEnv) triggerTrap("Flag");
    let inspector;
    let performance;
    let net;
        try{
            inspector = await import('inspector');
            net = await import('net');
            const hook = await import('perf_hooks');
            performance = hook.performance;
        }catch{
            inspector = require('inspector');
            net = require('net');
            performance = require('perf_hooks').performance;
        }
        if (process.execArgv.includes('--inspect') || process.execArgv.includes('--inspect-brk')) {
          process.exit(0);
        }
        const checkInspector = () => {
            if (inspector && inspector.url && inspector.url() !== undefined) triggerTrap("API");
        };
        const checkPorts = () => {
        const portsToCheck = [9229, 5858];
            portsToCheck.forEach(port => {
            const socket = new net.Socket();
                socket.once('connect', () => {
                socket.destroy();
                        while(true){}
                });
                socket.once('error', () => {socket.destroy();});
                socket.connect(port, '127.0.0.1');
            });
        };
    function initSecurity() {
        checkInspector();
        checkPorts();
        setInterval(() => {
            checkInspector();
            checkPorts();
        },1);
    }initSecurity();
})();
