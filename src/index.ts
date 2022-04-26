import CristataServer from './Cristata';

/* eslint-disable no-useless-escape */
import { Configuration } from './types/config';

const config: Configuration = {
  allowedOrigins: [
    'http://localhost:3000',
    'http://localhost:4000',
    'https://thepaladin.cristata.app',
    'https://api.thepaladin.cristata.app',
    'https://thepaladin.dev.cristata.app',
    'https://api.thepaladin.dev.cristata.app',
    'https://thepaladin.news',
    'https://new.thepaladin.news',
    'https://dev.thepaladin.news',
    'https://4000-gray-guineafowl-g1n8eq87.ws-us30.gitpod.io',
    'https://3000-green-tarantula-v58yhlbx.ws-us38.gitpod.io',
    'https://3000-jackbuehner-cristatawebs-8vze2ewl1dp.ws-us38.gitpod.io',
  ],
  collections: [],
  connection: {
    username: process.env.MONGO_DB_USERNAME || '',
    password: process.env.MONGO_DB_PASSWORD || '',
    host: `editor0.htefm.mongodb.net`,
    database: process.env.MONGO_DB_NAME || 'db_2',
    options: `retryWrites=true&w=majority`,
  },
  defaultSender: 'Cristata <noreply@thepaladin.news>',
  defaultTeams: [
    { name: 'Board', slug: 'board', id: '000000000000000000000002' },
    { name: 'Managing Editors', slug: 'managing-editors', id: '000000000000000000000003' },
    { name: 'Editing Team', slug: 'editing-team', id: '000000000000000000000004' },
    { name: 'Social Media', slug: 'social-media', id: '000000000000000000000007' },
    { name: 'Short URL Creators', slug: 'shorturl', id: '000000000000000000000008' },
    { name: 'The Royal Flush', slug: 'flusher', id: '000000000000000000000009' },
  ],
  minimumClientVersion: '0.9.0',
  tenantDisplayName: 'The Paladin Network',
  introspection: true,
  navigation: {
    main: [
      { label: 'Home', icon: 'Home32Regular', to: '/', subNav: 'forceCollapseForRoute' },
      { label: 'CMS', icon: 'ContentView32Regular', to: { first: 'cms' } },
      { label: 'Teams', icon: 'PeopleTeam28Regular', to: '/teams', subNav: 'hideMobile' },
      { label: 'Profiles', icon: 'Person32Regular', to: '/profile' },
      {
        label: 'API',
        icon: 'Play24Regular',
        to: '/playground',
        isHidden: { notInTeam: '000000000000000000000001' },
        subNav: 'hideMobile',
      },
      {
        label: 'Analytics',
        icon: 'DataUsage24Regular',
        to: '/embed/fathom',
        isHidden: { notInTeam: '000000000000000000000001' },
        subNav: 'forceCollapseForRoute',
      },
      {
        label: 'Configure',
        icon: 'Options24Regular',
        to: '/configuration',
        isHidden: { notInTeam: '000000000000000000000001' },
        subNav: 'hideMobile',
      },
    ],
    sub: {
      cms: [
        {
          label: `Articles`,
          items: [
            {
              label: `In-progress articles`,
              icon: 'DocumentPageBottomRight24Regular',
              to: `/cms/collection/articles?!stage=[5.1,5.2]&__pageTitle=In-progress articles&__pageCaption=The articles we are planning, drafting, and editing.&__defaultSortKey=timestamps.target_publish_at&__defaultSortKeyOrder=-1`,
            },
            {
              label: `All articles`,
              icon: 'DocumentOnePage24Regular',
              to: `/cms/collection/articles?__pageTitle=All articles&__pageCaption=Every article that is in-progress or published on the web.&__defaultSortKey=timestamps.target_publish_at&__defaultSortKeyOrder=-1`,
            },
            {
              label: `News articles (in-progress)`,
              icon: 'News24Regular',
              to: `/cms/collection/articles?!stage=[5.1,5.2]&categories=%5B"news"%5D&__pageTitle=In-progress news articles&__pageCaption=The news articles we are planning, drafting, and editing.&__defaultSortKey=timestamps.target_publish_at&__defaultSortKeyOrder=-1`,
            },
            {
              label: `Opinions (in-progress)`,
              icon: 'Chat24Regular',
              to: `/cms/collection/articles?!stage=[5.1,5.2]&categories=%5B"opinion"%5D&__pageTitle=In-progress opinions&__pageCaption=The opinions we are planning, drafting, and editing.&__defaultSortKey=timestamps.target_publish_at&__defaultSortKeyOrder=-1`,
            },
            {
              label: `Sports articles (in-progress)`,
              icon: 'Sport24Regular',
              to: `/cms/collection/articles?!stage=[5.1,5.2]&categories=%5B"sports"%5D&__pageTitle=In-progress sports articles&__pageCaption=The sports articles we are planning, drafting, and editing.&__defaultSortKey=timestamps.target_publish_at&__defaultSortKeyOrder=-1`,
            },
            {
              label: `Diversity matters articles (in-progress)`,
              icon: 'Star24Regular',
              to: `/cms/collection/articles?!stage=[5.1,5.2]&categories=%5B"diversity"%5D&__pageTitle=In-progress diversity matters articles&__pageCaption=The diversity matters articles we are planning, drafting, and editing.&__defaultSortKey=timestamps.target_publish_at&__defaultSortKeyOrder=-1`,
            },
            {
              label: `Arts articles (in-progress)`,
              icon: 'PaintBrush24Regular',
              to: `/cms/collection/articles?!stage=[5.1,5.2]&categories=%5B"arts"%5D&__pageTitle=In-progress arts articles&__pageCaption=The arts articles we are planning, drafting, and editing.&__defaultSortKey=timestamps.target_publish_at&__defaultSortKeyOrder=-1`,
            },
            {
              label: `Campus & culture articles (in-progress)`,
              icon: 'Balloon16Regular',
              to: `/cms/collection/articles?!stage=[5.1,5.2]&categories=%5B"campus-culture"%5D&__pageTitle=In-progress campus and culture articles&__pageCaption=The campus and culture articles we are planning, drafting, and editing.&__defaultSortKey=timestamps.target_publish_at&__defaultSortKeyOrder=-1`,
            },
          ],
        },
        {
          label: `Photos`,
          items: [
            {
              label: `Unfulfilled photo requests`,
              icon: 'ImageSearch24Regular',
              to: `/cms/collection/photo-requests?!stage=[3.1]&__pageTitle=Unfulfilled photo requests&__pageCaption=If a photo you need is not in the photo library, make a request here.`,
            },
            {
              label: `All photo requests`,
              icon: 'ImageSearch24Regular',
              to: `/cms/collection/photo-requests?__pageTitle=All photo requests&__pageCaption=Every fulfilled and unfulfilled photo request.`,
            },
            {
              label: `Photo library`,
              icon: 'Image24Regular',
              to: `/cms/photos/library`,
            },
          ],
        },
        {
          label: `Satire`,
          items: [
            {
              label: `In-progress satire`,
              icon: 'DocumentPageBottomRight24Regular',
              to: `/cms/collection/satire?!stage=[5.1,5.2]&__pageTitle=In-progress satire&__pageCaption=The satire we are planning, drafting, and editing.&__defaultSortKey=timestamps.target_publish_at&__defaultSortKeyOrder=-1`,
            },
            {
              label: `All satire`,
              icon: 'Cookies24Regular',
              to: `/cms/collection/satire?__pageTitle=All satire&__pageCaption=Every piece of satire that is in-progress or published on the web.&__defaultSortKey=timestamps.target_publish_at&__defaultSortKeyOrder=-1`,
            },
          ],
        },
        {
          label: `The Flusher`,
          items: [
            {
              label: `(T)Issues`,
              icon: 'Document24Regular',
              to: `/cms/collection/flush?__pageTitle=The Flusher&__pageCaption=The Paladin Network's restroom newsletter`,
              isHidden: { notInTeam: ['000000000000000000000001', '000000000000000000000009'] },
            },
          ],
        },
        {
          label: `Short URLs`,
          items: [
            {
              label: `flusher.page`,
              icon: 'BookGlobe24Regular',
              to: `/cms/collection/short-url?__pageTitle=Short URLs&__pageCaption=Generate short URLs that redirect to other pages.`,
              isHidden: { notInTeam: ['000000000000000000000001', '000000000000000000000008'] },
            },
          ],
        },
        {
          label: `Configuration`,
          items: [
            {
              label: `Featured articles`,
              icon: 'StarEmphasis24Regular',
              to: `/cms/collection/settings/Featured%20articles`,
              isHidden: { notInTeam: '000000000000000000000001' },
            },
            {
              label: `Social media articles (LIFT)`,
              icon: 'LinkSquare24Regular',
              to: `/cms/collection/settings/Social%20articles`,
              isHidden: { notInTeam: ['000000000000000000000001', '000000000000000000000007'] },
            },
          ],
        },
      ],
    },
  },
  dashboard: {
    collectionRows: [
      {
        header: { label: 'Articles', icon: 'News24Regular' },
        to: { idPrefix: '/cms/collection/articles/', idSuffix: '?fs=1&props=1' },
        query: `
          query {
            collectionRowArticles: articles(
              limit: 10
              filter: "{ \\\"hidden\\\": { \\\"$ne\\\": true } }"
              sort: "{ \\\"timestamps.modified_at\\\": -1 }"
            ) {
              docs {
                _id
                name
                description
                photo_path
                people {
                  last_modified_by {
                    name
                  }
                }
                timestamps {
                  modified_at
                }
              }
            }
          }
        `,
        arrPath: 'data.collectionRowArticles.docs',
        dataKeys: {
          _id: '_id',
          name: 'name',
          description: 'description',
          lastModifiedBy: 'people.last_modified_by.name',
          lastModifiedAt: 'timestamps.modified_at',
          photo: 'photo_path',
        },
      },
      {
        header: { label: 'Profiles', icon: 'PersonBoard24Regular' },
        to: { idPrefix: '/profile/', idSuffix: '' },
        query: `
          query {
            collectionRowUsers: users(
              limit: 10
              filter: "{ \\\"hidden\\\": { \\\"$ne\\\": true } }"
              sort: "{ \\\"timestamps.last_active_at\\\": -1 }"
            ) {
              docs {
                _id
                name
                photo
                timestamps {
                  last_active_at
                }
              }
            }
          }
        `,
        arrPath: 'data.collectionRowUsers.docs',
        dataKeys: {
          _id: '_id',
          name: 'name',
          photo: 'photo',
          lastModifiedBy: '_id',
          lastModifiedAt: 'timestamps.last_active_at',
        },
      },
      {
        header: { label: 'Photo requests', icon: 'ImageSearch24Regular' },
        to: { idPrefix: '/cms/collection/photo-requests/', idSuffix: '' },
        query: `
          query {
            collectionRowPhotoRequests: photoRequests(
              limit: 10
              filter: "{ \\\"hidden\\\": { \\\"$ne\\\": true } }"
              sort: "{ \\\"timestamps.modified_at\\\": -1 }"
            ) {
              docs {
                _id
                name
                people {
                  last_modified_by {
                    name
                  }
                }
                timestamps {
                  modified_at
                }
              }
            }
          }
        `,
        arrPath: 'data.collectionRowPhotoRequests.docs',
        dataKeys: {
          _id: '_id',
          name: 'name',
          lastModifiedBy: 'people.last_modified_by.name',
          lastModifiedAt: 'timestamps.modified_at',
        },
      },
    ],
  },
};

const server = new CristataServer(config);
server.start();

export default CristataServer;
export {
  GenSchemaInput,
  isSchemaDef,
  isSchemaRef,
  isTypeTuple,
  MongooseSchemaType,
  NumberOption,
  SchemaDef,
  SchemaDefType,
  StringOption,
} from './api/v3/helpers/generators/genSchema';
export { Collection, CollectionPermissionsActions } from './types/config';
