// pm2 process file — keeps the portfolio running and restarts it on crash/reboot.
//   npx pm2 start ecosystem.config.cjs
//   npx pm2 save && npx pm2 startup   (follow the printed command once)
module.exports = {
  apps: [
    {
      name: 'rudra-portfolio',
      cwd: __dirname,
      script: 'server/src/index.js',
      interpreter: 'node',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '300M',
      time: true,
    },
  ],
};
