import { EOL } from 'node:os';
import _ from 'lodash';
import { execa } from 'execa';
import { format, e } from '../../util.js';
import GitBase from '../GitBase.js';
import prompts from './prompts.js';
import ora from 'ora';

const options = { write: false };
const fixArgs = args => (args ? (typeof args === 'string' ? args.split(' ') : args) : []);

const isGitRepo = () =>
    execa('git', ['rev-parse', '--git-dir']).then(
        () => true,
        () => false
    );

class Git extends GitBase {
    constructor(...args) {
        super(...args);
        this.registerPrompts(prompts);
    }

    static async isEnabled(options) {
        return options !== false && (await isGitRepo());
    }

    async init() {
        await super.init();

        const remoteUrl = this.getContext('remoteUrl');
        if (this.options.push && !remoteUrl) {
            throw e(`无法获取远程Git url.${EOL}请添加远程存储库.`);
        }
    }

    rollback() {
        this.log.info('回滚更改...');
        const { tagName } = this.config.getContext();
        const { isTagged } = this.getContext();
        if (isTagged) {
            this.exec(`git tag --delete ${tagName}`);
        }
    }

    enableRollback() {
        this.rollbackOnce = _.once(this.rollback.bind(this));
        process.on('SIGINT', this.rollbackOnce);
        process.on('exit', this.rollbackOnce);
    }

    disableRollback() {
        if (this.rollbackOnce) {
            process.removeListener('SIGINT', this.rollbackOnce);
            process.removeListener('exit', this.rollbackOnce);
        }
    }

    async release() {
        const { increment, latestTag, tagName } = this.config.getContext();

        if (!(increment === 'current' || (tagName && tagName === latestTag))) {
            await this.step({
                enabled: true,
                task: () => this.tag(),
                label: 'Git tag',
                prompt: 'tag',
                failed: () => process.exit(0)
            });
        }

        return !!(await this.step({
            enabled: true,
            task: () => this.push({ tagName }),
            label: 'Git push',
            prompt: 'push'
        }));
    }

    async hasUpstreamBranch() {
        const ref = await this.exec('git symbolic-ref HEAD', { options });
        const branch = await this.exec(`git for-each-ref --format="%(upstream:short)" ${ref}`, { options }).catch(
            () => null
        );
        return Boolean(branch);
    }

    tagExists(tag) {
        return this.exec(`git show-ref --tags --quiet --verify -- refs/tags/${tag}`, { options }).then(
            () => true,
            () => false
        );
    }

    async getUpstreamArgs() {
        if (!(await this.hasUpstreamBranch())) {
            return ['--set-upstream', 'origin', await this.getBranchName()];
        } else {
            return [];
        }
    }

    status() {
        return this.exec('git status --short --untracked-files=no', { options }).catch(() => null);
    }

    tag({ name, annotation = this.options.tagAnnotation, args = this.options.tagArgs } = {}) {
        const message = format(annotation, this.config.getContext());
        const tagName = name || this.config.getContext('tagName');

        this.config.setContext({ tagName });

        return this.exec(['git', 'tag', '--annotate', '--message', message, ...fixArgs(args), tagName])
            .then(() => this.setContext({ isTagged: true }))
            .catch(err => {
                const { latestTag, tagName } = this.config.getContext();
                if (/tag '.+' already exists/.test(err) && latestTag === tagName) {
                    this.log.warn(`标签 "${tagName}" 已存在`);
                } else {
                    throw err;
                }
            });
    }

    async push({ tagName = '', args = this.options.pushArgs } = {}) {
        const upstreamArgs = [];

        tagName = tagName || this.config.getContext('tagName');

        const loadingSpinner = ora('Git push.').start();
        const push = await this.exec(['git', 'push', 'origin', tagName, ...fixArgs(args), ...upstreamArgs]);
        loadingSpinner.stop();

        this.disableRollback();

        return push;
    }

    afterRelease() {
        this.disableRollback();
    }
}

export default Git;
