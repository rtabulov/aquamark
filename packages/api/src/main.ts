import Koa from 'koa';
import router from './router';
import bodyParser from 'koa-bodyparser';
// @ts-expect-error
import respond from 'koa-respond';
import dotenv from 'dotenv-flow';

dotenv.config();

const APP_PORT = process.env.APP_PORT;

const app = new Koa();
app.use(respond());
app.use(bodyParser());

app.use(router.routes());
app.use(router.allowedMethods());

app.listen(APP_PORT, () => console.log('started on port', APP_PORT));
