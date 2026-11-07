// pm2 process file: keeps the portfolio running and restarts it after a crash or reboot.
//   pm2 start ecosystem.config.cjs
//   pm2 save && pm2 startup        (run the command it prints, once)
// If a proxy or tunnel on this machine fronts the site, change HOST to 127.0.0.1 and `pm2 restart rudra-portfolio`.
module.exports = {
  apps: [
    {
      name: 'rudra-portfolio',
      cwd: __dirname,
      script: 'server/src/server.js',
      interpreter: 'node',
      env: { NODE_ENV: 'production', PORT: 5000, HOST: '0.0.0.0' },
      max_memory_restart: '300M',
      time: true,
    },
  ],
};
