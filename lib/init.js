import fs from 'node:fs';

import Logger from './log.js';
import chalk from 'chalk';

export default function (workingPath) {
    const logger = new Logger;
    const configPath = './release-it.json';
    const envPath = './.release-it.env';

    workingPath = workingPath || process.cwd();

    try {
        fs.accessSync(workingPath);
    } catch (err) {
        logger.error('The working path is invalid. ', err);
        return;
    }

    logger.info();

    // fs.writeFileSync(envPath, `RELEASE_IT_WORKING_PATH=${workingPath}`);
    // logger.obtrusive(`🏁 Write env file to ${chalk.yellow(envPath)}`);

    try {

        if (fs.existsSync(configPath)) {
            return;
        }

        const sourceConfigPath = new URL('../config/release-it.json', import.meta.url);

        fs.accessSync(sourceConfigPath);
        fs.cpSync(sourceConfigPath, configPath, { recursive: true });

        logger.obtrusive(`🏁 Copied config to ${chalk.yellow(configPath)}`);
    } catch (err) {
        logger.error(err);

        return;
    }

    logger.info();
};