import { readJSON } from './util.js';
import Log from './log.js';
import runTasks from './index.js';
import Init from './init.js';

const pkg = readJSON(new URL('../package.json', import.meta.url));

const log = new Log();

const helpText = `Gupo Release It! v${pkg.version}

    使用: release-it <increment> [options]

    示例: "release-it --increment=minor" 或使用缩写 "release-it -i=minor".

    -c --config            指定配置文件 [默认: "./release-it.json"]
    -d --dry-run           调试运行
    -h --help              帮助文档
    -e --environment       指定环境
    -i --increment         指定增量版本 "current" "major", "minor", "patch"; [默认: "patch"]
        --ci               无提示、无用户交互（适用于CI环境）
        --only-version     仅提示选择版本后直接发布
    -v --version           输出工具版本号
    -V --verbose           详细输出
    -VV                    额外的详细输出
    --init=[working_path]  初始化配置文件
`;

/** @internal */
export const version = () => log.log(`v${pkg.version}`);

/** @internal */
export const help = () => log.log(helpText);

export default async options => {
    if (options.init) {
        Init(typeof options.init === 'boolean' ? '' : options.init);
    } else if (options.version) {
        version();
    } else if (options.help) {
        help();
    } else {
        return runTasks(options);
    }

    return Promise.resolve();
};
