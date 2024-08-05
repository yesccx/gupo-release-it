import semver from 'semver';

const inc = semver.inc;
semver.inc = function (
    version,
    increment,
    optionsOrLoose,
    identifier
) {
    try {
        if (increment === 'current') {
            return version;
        }

        const numVersion = version.match(/(?<=v)([\d\.]+)$/)[1];
        const nextVersion = inc(numVersion, increment, optionsOrLoose, identifier) || inc('1.0.0', increment, optionsOrLoose, identifier);

        return version.replace(/(?<=v)([\d\.]+)$/, nextVersion);
    } catch (e) {
        return inc(version, increment, optionsOrLoose, identifier);
    }
}

export default semver;