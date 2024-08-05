import semver from '../../customSemver.js';
import Plugin from '../Plugin.js';

const RELEASE_TYPES = ['patch', 'minor', 'major', 'current'];
const ALL_RELEASE_TYPES = [...RELEASE_TYPES];

const getIncrementChoices = context => {
    const latestVersion = context.latestVersion;

    return RELEASE_TYPES.map(increment => ({
        name: `${increment} (${semver.inc(latestVersion, increment)})`,
        value: increment
    }));
};

const prompts = {
    incrementList: {
        type: 'list',
        message: () => '选择发布版本:',
        choices: context => getIncrementChoices(context),
        pageSize: 9
    }
};

class Version extends Plugin {
    constructor(...args) {
        super(...args);
        this.registerPrompts(prompts);
    }

    getIncrement(options) {
        return options.increment;
    }

    getIncrementedVersionCI(options) {
        return this.incrementVersion(options);
    }

    async getIncrementedVersion(options) {
        const { isCI } = this.config;
        const version = this.incrementVersion(options);
        return version || (isCI ? null : await this.promptIncrementVersion(options));
    }

    promptIncrementVersion(options) {
        return new Promise(resolve => {
            this.step({
                prompt: 'incrementList',
                task: increment =>
                    increment
                        ? resolve(this.incrementVersion(Object.assign({}, options, { increment })))
                        : this.step({ prompt: 'version', task: resolve })
            });
        });
    }


    isValid(version) {
        return Boolean(semver.valid(version));
    }

    incrementVersion({ latestVersion, increment }) {
        if (increment === false) {
            return latestVersion;
        }

        const isValidVersion = this.isValid(increment);

        if (isValidVersion && semver.gte(increment, latestVersion)) {
            return increment;
        }

        if (this.config.isCI && !increment) {
            return semver.inc(latestVersion, 'patch');
        }

        const normalizedType = increment;
        if (ALL_RELEASE_TYPES.includes(normalizedType)) {
            return semver.inc(latestVersion, normalizedType);
        }

        const coercedVersion = !isValidVersion && semver.coerce(increment);
        if (coercedVersion) {
            this.log.warn(`Coerced invalid semver version "${increment}" into "${coercedVersion}".`);
            return coercedVersion.toString();
        }
    }
}

export default Version;
