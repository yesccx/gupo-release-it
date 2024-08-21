import { EOL } from 'node:os';
import { format, parseGitUrl, formatDate } from '../util.js';
import Plugin from './Plugin.js';
import ora from 'ora';

const options = { write: false };

class GitBase extends Plugin {
    async init() {
        const loadingSpinner = ora('Fetch repo info.').start();

        const remoteUrl = await this.getRemoteUrl();
        await this.fetch(remoteUrl);

        const branchName = await this.getBranchName();
        const repo = parseGitUrl(remoteUrl);
        this.setContext({ remoteUrl, branchName, repo });
        this.config.setContext({ remoteUrl, branchName, repo });

        const latestTag = await this.getLatestTagName();

        this.config.setContext({ latestTag });

        loadingSpinner.stop();
    }

    getName() {
        return this.getContext('repo.project');
    }

    async getLatestVersion() {
        let { latestTag: latestVersion } = this.config.getContext();

        let latestTaggerName = '', latestTaggerDate = '';

        if (latestVersion) {
            const tagInfo = await this.exec(`git for-each-ref --format='%(taggername)@@@%(taggerdate)' refs/tags/${latestVersion}`).then(
                stdout => stdout || null,
                () => null
            );

            if (tagInfo) {
                [latestTaggerName, latestTaggerDate] = tagInfo.split('@@@');

                if (latestTaggerDate) {
                    latestTaggerDate = formatDate(latestTaggerDate);
                }
            }

            // Fallback to commit info if tag info is not available
            if (!latestTaggerName || !latestTaggerDate) {
                const commitInfo = await this.exec(`git show -s --format='#Committer#%cn#Committer##Date#%cd#Date#' refs/tags/${latestVersion}`).then(
                    stdout => stdout || null,
                    () => null
                );

                if (commitInfo) {
                    latestTaggerName = commitInfo.match(/#Committer#(.*?)#Committer#/)[1];
                    latestTaggerDate = commitInfo.match(/#Date#(.*?)#Date#/)[1];
                    if (latestTaggerDate) {
                        latestTaggerDate = formatDate(latestTaggerDate);
                    }
                }
            }
        }

        if (!latestVersion) {
            latestVersion = this.getInitialVersion();
        }

        return { latestVersion, latestTaggerName, latestTaggerDate };
    }

    getInitialVersion() {
        return this.config.getContext('tagRegex').replace(/v\(.*?\)/, 'v0.0.0');
    }

    bump(version) {
        Object.assign(this.config.getContext(), { version });
        const tagName = version;
        this.setContext({ version });
        this.config.setContext({ tagName });
    }

    isRemoteName(remoteUrlOrName) {
        return remoteUrlOrName && !remoteUrlOrName.includes('/');
    }

    async getRemoteUrl() {
        const remoteNameOrUrl = (await this.getRemote()) || 'origin';
        return this.isRemoteName(remoteNameOrUrl)
            ? this.exec(`git remote get-url ${remoteNameOrUrl}`, { options }).catch(() =>
                this.exec(`git config --get remote.${remoteNameOrUrl}.url`, { options }).catch(() => null)
            )
            : remoteNameOrUrl;
    }

    async getRemote() {
        const branchName = await this.getBranchName();
        return branchName ? await this.getRemoteForBranch(branchName) : null;
    }

    getBranchName() {
        return this.exec('git rev-parse --abbrev-ref HEAD', { options }).catch(() => null);
    }

    getRemoteForBranch(branch) {
        return this.exec(`git config --get branch.${branch}.remote`, { options }).catch(() => null);
    }

    fetch(remoteUrl) {
        return this.exec('git fetch').catch(err => {
            this.debug(err);
            throw new Error(`Unable to fetch from ${remoteUrl}${EOL}${err.message}`);
        });
    }

    async getLatestTagName() {
        const context = Object.assign({}, this.config.getContext(), { version: '*' });
        const match = format(this.config.getContext('tagMatch') || '${version}', context);

        try {
            const rawMatchedTags = await this.exec(`git tag -l "${match}" --sort=-taggerdate`, { options }).then(
                stdout => stdout || null,
                () => null
            );

            const matchedTags = rawMatchedTags.split(EOL)
                .map((t) => t.trim())
                .filter((t) => t.match(match))
                .sort()
                .reverse();

            if (matchedTags.length > 0) {
                return matchedTags[0];
            }
        } catch (e) {
        }

        return await this.fallbackGetLatestTagName();
    }

    async fallbackGetLatestTagName() {
        const context = Object.assign({}, this.config.getContext(), { version: '*' });
        const match = format(this.config.getContext('tagMatch') || '${version}', context);

        const commitId = await this.exec(`git rev-list --tags="${match}" --max-count=1`, { options }).then(
            stdout => stdout || null,
            () => null
        );

        if (!commitId) {
            return null;
        }

        try {
            const rawMatchedTags = await this.exec(`git tag --contains ${commitId}`, { options }).then(
                stdout => stdout || null,
                () => null
            );

            const matchedTags = rawMatchedTags.split(EOL)
                .map((t) => t.trim())
                .filter((t) => t.match(match))
                .sort()
                .reverse();

            if (matchedTags.length > 1) {
                return matchedTags[0];
            }
        } catch (e) {

        }

        return this.exec(`git describe --abbrev=0 --match="${match}" --tags ${commitId}`, { options }).then(
            stdout => stdout || null,
            () => null
        );
    }
}

export default GitBase;
