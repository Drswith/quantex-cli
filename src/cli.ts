import { program } from 'commander'

program
  .name('silver')
  .description('统一的 AI Agent CLI 管理工具')
  .version('0.0.0')

program
  .command('list')
  .alias('ls')
  .description('列出所有支持的 agent')
  .action(() => {
    console.log('TODO: list agents')
  })

program
  .command('install <agent>')
  .alias('i')
  .description('安装指定 agent')
  .action((agent: string) => {
    console.log(`TODO: install ${agent}`)
  })

program
  .command('update <agent>')
  .alias('u')
  .description('更新指定 agent')
  .action((agent: string) => {
    console.log(`TODO: update ${agent}`)
  })

program
  .command('uninstall <agent>')
  .alias('rm')
  .description('卸载指定 agent')
  .action((agent: string) => {
    console.log(`TODO: uninstall ${agent}`)
  })

program
  .command('info <agent>')
  .description('查看 agent 详细信息')
  .action((agent: string) => {
    console.log(`TODO: info ${agent}`)
  })

program
  .command('doctor')
  .description('检查环境')
  .action(() => {
    console.log('TODO: doctor')
  })

program.parse()
