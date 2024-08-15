import Plugin from '../Plugin.js';
import { e, format } from '../../util.js';
import _ from 'lodash';

import prompts, { getIncrementChoices } from './prompts.js';

class Environment extends Plugin {
    constructor(...args) {
        super(...args);
        this.registerPrompts(prompts);
    }

    async init() {
        const { environments, environment } = this.config.getContext();

        if (!environments.filter((item) => item.enabled && item.regex).length) {
            throw e(`请先在config中配置发布环境.`);
        }

        if (environments.length === 1) {
            this.initSetContext(environmentData[0]);

            return;
        }

        const environmentData = _.find(environments, { alias: environment });
        if (environmentData) {
            this.initSetContext(environmentData);

            return;
        }

        return new Promise(resolve => {
            this.step({
                prompt: 'alias',
                task: (environmentData) => {
                    this.initSetContext(environmentData);

                    resolve();
                }
            });
        });
    }

    tagRegex(rawTagRegex) {
        return rawTagRegex.replace(/v\(.*?\)/, 'v*');
    }

    async getLatestVersion() {
        let { tagMatch, tagRegex } = this.config.getContext();

        if (!tagMatch) {
            throw e(`无效的发布环境.`);
        }

        if (!tagRegex || !tagRegex.match(/v\(.*?\)/)) {
            throw e(`无效的发布环境.`);
        }

        return '';
    }

    afterRelease() {
        const {
            pipe_builder_url_template: pipeBuilderUrlTemplate,
            pipe_deploy_url_template: pipeDeployUrlTemplate
        } = this.config.getContext();

        const tagOptions = this.config.getContext('tagOptions');

        if (!tagOptions.builder_pipe_num && !tagOptions.deploy_pipe_num) {
            return;
        }

        this.log.info();

        if (pipeBuilderUrlTemplate && tagOptions.builder_pipe_num) {
            this.log.info('🔗 ' + format(pipeBuilderUrlTemplate, { pipe_num: tagOptions.builder_pipe_num }));
        }

        if (pipeDeployUrlTemplate && tagOptions.deploy_pipe_num) {
            this.log.info('🔗 ' + format(pipeDeployUrlTemplate, { pipe_num: tagOptions.deploy_pipe_num }));
        }
    }

    initSetContext(environmentData) {
        this.config.setContext({
            tagMatch: this.tagRegex(environmentData.regex ?? ''),
            tagRegex: environmentData.regex ?? '',
            tagOptions: environmentData.options ?? [],
            environmentName: environmentData.name ?? ''
        });
    }
}

export default Environment;
