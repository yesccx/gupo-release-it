import { format } from '../../util.js';

export default {
    tag: {
        type: 'confirm',
        message: context => `Tag (${format(context.tagName, context)})?`,
        default: true,
    },
    push: {
        type: 'confirm',
        message: () => 'Push Tag?',
        default: true
    }
};
