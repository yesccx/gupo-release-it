import fs from 'node:fs';
import { EOL } from 'node:os';
import _ from 'lodash';
import gitUrlParse from 'git-url-parse';
import semver from './customSemver.js';
import osName from 'os-name';
import Log from './log.js';

const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));

const pkg = readJSON(new URL('../package.json', import.meta.url));

const log = new Log();

const getSystemInfo = () => {
    return {
        'release-it': pkg.version,
        node: process.version,
        os: osName()
    };
};

const format = (template = '', context = {}) => {
    try {
        return _.template(template)(context);
    } catch (error) {
        log.error(`Unable to render template with context:\n${template}\n${JSON.stringify(context)}`);
        log.error(error);
        throw error;
    }
};

const truncateLines = (input, maxLines = 10, surplusText = null) => {
    const lines = input.split(EOL);
    const surplus = lines.length - maxLines;
    const output = lines.slice(0, maxLines).join(EOL);
    return surplus > 0 ? (surplusText ? `${output}${surplusText}` : `${output}${EOL}...and ${surplus} more`) : output;
};

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const rejectAfter = (ms, error) =>
    wait(ms).then(() => {
        throw error;
    });

const parseGitUrl = remoteUrl => {
    if (!remoteUrl) return { host: null, owner: null, project: null, protocol: null, remote: null, repository: null };
    const normalizedUrl = (remoteUrl || '')
        .replace(/^[A-Z]:\\\\/, 'file://') // Assume file protocol for Windows drive letters
        .replace(/^\//, 'file://') // Assume file protocol if only /path is given
        .replace(/\\+/g, '/'); // Replace forward with backslashes
    const parsedUrl = gitUrlParse(normalizedUrl);
    const { resource: host, name: project, protocol, href: remote } = parsedUrl;
    const owner = protocol === 'file' ? _.last(parsedUrl.owner.split('/')) : parsedUrl.owner; // Fix owner for file protocol
    const repository = `${owner}/${project}`;
    return { host, owner, project, protocol, remote, repository };
};

const reduceUntil = async (collection, fn) => {
    let result;
    for (const item of collection) {
        if (result) break;
        result = await fn(item);
    }
    return result;
};

const hasAccess = path => {
    try {
        fs.accessSync(path);
        return true;
    } catch (err) {
        return false;
    }
};

const parseVersion = (raw, options) => {
    if (raw == null) {
        return { version: raw }
    };

    const matchedVersion = new RegExp(options.tagRegex).exec(raw);
    if (matchedVersion) {
        return { version: `v${matchedVersion[1]}` };
    }

    const version = semver.valid(raw) ? raw : semver.coerce(raw);

    if (!version) {
        return { version: raw }
    };


    return { version: version.toString() };
};

const e = (message, docs, fail = true) => {
    const error = new Error(message);

    error.code = fail ? 1 : 0;

    return error;
};

const formatDate = (date) => {
    try {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }

        const padZero = (num) => _.padStart(num, 2, '0');

        const year = date.getFullYear();
        const month = padZero(date.getMonth() + 1);
        const day = padZero(date.getDate());
        const hours = padZero(date.getHours());
        const minutes = padZero(date.getMinutes());
        const seconds = padZero(date.getSeconds());

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (e) {
        return '';
    }
}

export {
    getSystemInfo,
    format,
    truncateLines,
    rejectAfter,
    reduceUntil,
    parseGitUrl,
    hasAccess,
    parseVersion,
    readJSON,
    e,
    formatDate
};
