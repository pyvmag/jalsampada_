module.exports = {
  apps: [{
    name: 'jalsampada',
    script: 'server.js',
    interpreter: '/home/erpadmin/.bun/bin/bun',
    cwd: '/home/erpadmin/bench-dev-jalsampada/apps/Jalsampada_ui/.next/standalone',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '2G',
    env: {
      NODE_ENV: 'production',
      PORT: 2225,
      HOSTNAME: '0.0.0.0'
    },
    error_file: '/home/erpadmin/bench-dev-jalsampada/apps/Jalsampada_ui/logs/err.log',
    out_file: '/home/erpadmin/bench-dev-jalsampada/apps/Jalsampada_ui/logs/out.log',
    log_file: '/home/erpadmin/bench-dev-jalsampada/apps/Jalsampada_ui/logs/combined.log',
    time: true
  }]
};
