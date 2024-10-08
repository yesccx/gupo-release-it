import _ from 'lodash';
import { getPlugins } from './plugin/factory.js';
import Logger from './log.js';
import Config from './config.js';
import Shell from './shell.js';
import Prompt from './prompt.js';
import Spinner from './spinner.js';
import { reduceUntil, parseVersion } from './util.js';
import chalk from 'chalk';
import { EOL } from 'node:os';

const runTasks = async (opts, di) => {
    let container = {};

    try {
        Object.assign(container, di);
        container.config = container.config || new Config(opts);

        const { config } = container;
        const { isCI, isVerbose, verbosityLevel, isDryRun } = config;

        container.log = container.log || new Logger({ isCI, isVerbose, verbosityLevel, isDryRun });
        container.spinner = container.spinner || new Spinner({ container, config });
        container.prompt = container.prompt || new Prompt({ container: { config } });
        container.shell = container.shell || new Shell({ container });

        const { log, shell, spinner } = container;

        const options = config.getContext();

        const { hooks } = options;

        try {
            process.chdir(options.working_path);
        } catch(e) {
            throw new Error(`Invalid working path.${EOL}${e}`);
        }

        const runHook = async (...name) => {
            const scripts = hooks[name.join(':')];

            if (!scripts || !scripts.length) {
                return;
            }

            const context = config.getContext();
            const external = true;

            for (const script of _.castArray(scripts)) {
                const task = () => shell.exec(script, { external }, context);
                await spinner.show({ task, label: script, context, external });
            }
        };

        const runLifeCycleHook = async (plugin, name, ...args) => {
            if (plugin === _.first(plugins)) {
                await runHook('before', name);
            }

            await runHook('before', plugin.namespace, name);

            const willHookRun = (await plugin[name](...args)) !== false;

            if (willHookRun) {
                await runHook('after', plugin.namespace, name);
            }

            if (plugin === _.last(plugins)) {
                await runHook('after', name);
            }
        };

        const [internal, external] = await getPlugins(config, container);
        let plugins = [...external, ...internal];
        for (const plugin of plugins) {
            await runLifeCycleHook(plugin, 'init');
        }

        const { increment } = options.version;

        const name = await reduceUntil(plugins, plugin => plugin.getName());
        const { latestVersion, latestTaggerName, latestTaggerDate } = (await reduceUntil(plugins, plugin => plugin.getLatestVersion()));

        const incrementBase = { latestVersion, increment };

        let version;
        if (config.isIncrement) {
            incrementBase.increment = await reduceUntil(plugins, plugin => plugin.getIncrement(incrementBase));
            version = await reduceUntil(plugins, plugin => plugin.getIncrementedVersionCI(incrementBase));
        } else {
            version = latestVersion;
        }

        config.setContext({ name, latestVersion, version });

        {
            const environmentName = config.getContext('environmentName');

            const suffix = (environmentName ? `🚀 ${chalk.cyan(environmentName)}${EOL}${EOL}` : '') + `> Latest Version: ${chalk.yellow(latestVersion)}`;

            const prefix = latestTaggerName && latestTaggerDate
                ? `${EOL}# <Author>: ${latestTaggerName} <Date>: ${latestTaggerDate}`
                : '';

            log.obtrusive(`${suffix}${chalk.gray(prefix)}`);
        }

        if (config.isIncrement) {
            version = version || (await reduceUntil(plugins, plugin => plugin.getIncrementedVersion(incrementBase)));
        }

        if (!version) {
            log.obtrusive(`The version is invalid`);
        }

        if (version) {
            config.setContext(parseVersion(version, config.getContext()));

            if (config.isPromptOnlyVersion) {
                config.setCI(true);
            }

            if (isCI) {
                log.obtrusive(`> Release version ${chalk.yellow(version)}`);
            }

            for (const hook of ['beforeBump', 'bump', 'beforeRelease']) {
                for (const plugin of plugins) {
                    const args = hook === 'bump' ? [version] : [];
                    await runLifeCycleHook(plugin, hook, ...args);
                }
            }

            plugins = [...internal, ...external];

            for (const hook of ['release', 'afterRelease']) {
                for (const plugin of plugins) {
                    await runLifeCycleHook(plugin, hook);
                }
            }
        }

        log.log(`${EOL}🏁 Successful!`);

        return {
            name,
            latestVersion,
            version
        };
    } catch (err) {
        const { log } = container;

        log ? log.error(err.message || err) : console.error(err); // eslint-disable-line no-console

        throw err;
    }
};

export default runTasks;

export { default as Config } from './config.js';

export { default as Plugin } from './plugin/Plugin.js';
