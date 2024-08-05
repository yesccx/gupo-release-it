import url from 'node:url';
import path from 'node:path';
import util from 'node:util';
import { createRequire } from 'node:module';
import _ from 'lodash';
import Environment from './environment/Environment.js';
import Version from './version/Version.js';
import Git from './git/Git.js';

const debug = util.debug('release-it:plugins');

const pluginNames = ['environment', 'git', 'version'];

const plugins = {
    version: Version,
    environment: Environment,
    git: Git,
};

const load = async pluginName => {
    let plugin = null;
    try {
        const module = await import(pluginName);
        plugin = module.default;
    } catch (err) {
        try {
            const module = await import(path.join(process.cwd(), pluginName));
            plugin = module.default;
        } catch (err) {
            // In some cases or tests we might need to support legacy `require.resolve`
            const require = createRequire(process.cwd());
            const module = await import(url.pathToFileURL(require.resolve(pluginName, { paths: [process.cwd()] })));
            plugin = module.default;
        }
    }
    return [getPluginName(pluginName), plugin];
};

/** @internal */
export const getPluginName = pluginName => {
    if (pluginName.startsWith('.')) {
        return path.parse(pluginName).name;
    }

    return pluginName;
};

export let getPlugins = async (config, container) => {
    const context = config.getContext();
    const disabledPlugins = [];

    const enabledExternalPlugins = await _.reduce(
        context.plugins,
        async (result, pluginConfig, pluginName) => {
            const [name, Plugin] = await load(pluginName);
            const [namespace, options] = pluginConfig.length === 2 ? pluginConfig : [name, pluginConfig];
            config.setContext({ [namespace]: options });
            if (await Plugin.isEnabled(options)) {
                const instance = new Plugin({ namespace, options: config.getContext(), container });
                debug({ namespace, options: instance.options });
                (await result).push(instance);
                disabledPlugins.push(..._.intersection(pluginNames, _.castArray(Plugin.disablePlugin(options))));
            }
            return result;
        },
        []
    );

    const enabledPlugins = await pluginNames.reduce(async (result, plugin) => {
        if (plugin in plugins && !disabledPlugins.includes(plugin)) {
            const Plugin = plugins[plugin];
            const pluginOptions = context[plugin];
            if (await Plugin.isEnabled(pluginOptions)) {
                const instance = new Plugin({ namespace: plugin, options: context, container });
                debug({ namespace: plugin, options: instance.options });
                (await result).push(instance);
            }
        }
        return result;
    }, []);

    return [enabledPlugins, enabledExternalPlugins];
};
