const main = require('./functions/index');
main.main({ method: 'GET', query: { token: process.env.pnut_token, show: 'mondaynightdanceparty'}}, {});