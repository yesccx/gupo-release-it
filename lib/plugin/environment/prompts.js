export const getIncrementChoices = context => {
    return context.environments.filter((item) => item.enabled).map((item) => ({
        name: `${item.name} #${item.regex}`,
        value: item
    }));
};

export default {
    alias: {
        type: 'list',
        message: () => 'Select environment:',
        choices: context => getIncrementChoices(context),
        pageSize: 5
    }
};
