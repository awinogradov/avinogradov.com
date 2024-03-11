/* eslint-disable import/no-extraneous-dependencies */

import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import browserSync from 'browser-sync';
import Metalsmith from 'metalsmith';
import markdown from '@metalsmith/markdown';
import layouts from '@metalsmith/layouts';
import collections from '@metalsmith/collections';
import drafts from '@metalsmith/drafts';
import permalinks from '@metalsmith/permalinks';
import htmlMinifier from 'metalsmith-html-minifier';
import assets from 'metalsmith-static-files';
import metadata from '@metalsmith/metadata';
import * as marked from 'marked';

// ESM does not currently import JSON modules by default.
// Ergo we'll JSON.parse the file manually
import { readFileSync } from 'fs';

const { devDependencies } = JSON.parse(readFileSync('./package.json'));

/* eslint-disable no-underscore-dangle */
const __dirname = dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

// functions to extend Nunjucks environment
const spaceToDash = (string) => string.replace(/\s+/g, '-');
const condenseTitle = (string) => string.toLowerCase().replace(/\s+/g, '');
const UTCdate = (date) => date.toUTCString('M d, yyyy');
const blogDate = (string) =>
    new Date(string).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
const trimSlashes = (string) => string.replace(/(^\/)|(\/$)/g, '');
const md = (mdString) => {
    try {
        return marked.parse(mdString, { mangle: false, headerIds: false });
    } catch (e) {
        return mdString;
    }
};
const thisYear = () => new Date().getFullYear();

// Define engine options for the inplace and layouts plugins
const templateConfig = {
    directory: 'layouts',
    engineOptions: {
        path: ['layouts'],
        filters: {
            spaceToDash,
            condenseTitle,
            UTCdate,
            blogDate,
            trimSlashes,
            md,
            thisYear,
        },
    },
};

function noop() {}

let devServer = null;

function msBuild() {
    return Metalsmith(__dirname)
        .clean(true)
        .watch(isProduction ? false : ['src', 'layouts'])
        .source('./src/content')
        .destination('./build')

        .use(isProduction ? noop : drafts())

        .metadata({
            msVersion: devDependencies.metalsmith,
            nodeVersion: process.version,
            baseUrl: process.env.BASE_URL,
        })
        .use(
            metadata({
                site: 'src/content/data/site.json',
                nav: 'src/content/data/navigation.json',
            }),
        )

        .use(
            collections({
                blog: {
                    pattern: 'blog/*.md',
                    sortBy: 'date',
                    reverse: true,
                    limit: 10,
                },
            }),
        )

        .use(markdown())

        .use(permalinks())

        .use(layouts(templateConfig))

        .use(
            assets({
                source: 'src/assets/',
                destination: 'assets/',
            }),
        )

        .use(htmlMinifier());
}

const ms = msBuild();
ms.build((err) => {
    if (err) {
        throw err;
    }

    if (ms.watch()) {
        if (devServer) {
            devServer.reload();
        } else {
            devServer = browserSync.create();
            devServer.init({
                host: 'localhost',
                server: './build',
                port: 3000,
                injectChanges: false,
                reloadThrottle: 0,
            });
        }
    }
});
