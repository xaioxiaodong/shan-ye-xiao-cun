/**
 * PM2 进程管理配置文件
 *
 * 使用方式：
 *   pm2 start ecosystem.config.cjs
 *   pm2 logs game-signaling
 *   pm2 monit
 *   pm2 restart game-signaling
 *   pm2 stop game-signaling
 */
module.exports = {
  apps: [
    {
      name: 'game-signaling',
      script: './signaling-server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        WS_PORT: 8888,
        HTTP_PORT: 8889,
      },
      // 日志配置
      error_file: './logs/error.log',
      out_file: './logs/output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      // 崩溃自动重启
      max_restarts: 10,
      restart_delay: 3000,
      min_uptime: '10s',
    },
  ],
};
