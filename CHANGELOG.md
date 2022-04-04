# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [2.8.0](https://github.com/jackbuehner/cristata-api/compare/v2.7.0...v2.8.0) (2022-04-04)


### Features

* support current datetime in public rules ([ec8a4a7](https://github.com/jackbuehner/cristata-api/commit/ec8a4a7184ca4d418951f7c282a73dbf8b272349))

## [2.7.0](https://github.com/jackbuehner/cristata-api/compare/v2.7.0-0...v2.7.0) (2022-04-04)


### Features

* include dashboard collection row configuration ([6d83b86](https://github.com/jackbuehner/cristata-api/commit/6d83b86cf62fd9b3a158cae4f487f80dd9397889))
* keep track of when user was last active ([06eeda1](https://github.com/jackbuehner/cristata-api/commit/06eeda13ef1c0f300b314bfd04f80c8351069ca6))

## [2.7.0-0](https://github.com/jackbuehner/cristata-api/compare/v2.6.1-2...v2.7.0-0) (2022-04-04)


### Features

* better handling when references are null instead of object id ([5d982bc](https://github.com/jackbuehner/cristata-api/commit/5d982bc3a938acc98fa2fd4438a2ae8757159f34))


### Bug Fixes

* attempt to use .save() with lean document ([9b2a7cc](https://github.com/jackbuehner/cristata-api/commit/9b2a7cc25f2ad129973b3756a0b7257715616fe2))
* converting object id protype when attempring to convert null prototype ([d202211](https://github.com/jackbuehner/cristata-api/commit/d202211fafccea3b1f6447f21302ba5930fddee9))
* user ids not collapsing to distinct values in set ([0d02529](https://github.com/jackbuehner/cristata-api/commit/0d025294857927bb6cad4bdcaaaff6f65f3e320d))

### [2.6.1-2](https://github.com/jackbuehner/cristata-api/compare/v2.6.1-1...v2.6.1-2) (2022-04-03)


### Bug Fixes

* incorrect resolver structure ([d12a710](https://github.com/jackbuehner/cristata-api/commit/d12a710dd79fe9f1b986a13e2fd69ebdbdfc7d9d))

### [2.6.1-1](https://github.com/jackbuehner/cristata-api/compare/v2.6.1-0...v2.6.1-1) (2022-04-03)


### Bug Fixes

* incorrect graphql array syntax ([27f4a86](https://github.com/jackbuehner/cristata-api/commit/27f4a86403995614344e16b9841cc77ee1d81e0a))

### [2.6.1-0](https://github.com/jackbuehner/cristata-api/compare/v2.6.0...v2.6.1-0) (2022-04-03)

## [2.6.0](https://github.com/jackbuehner/cristata-api/compare/v2.5.3...v2.6.0) (2022-04-03)


### Features

* add app navigation to config ([cadf908](https://github.com/jackbuehner/cristata-api/commit/cadf9085b90b357d011aad70f5bd0ac7ebe21745))
* enable getting navigation config through api ([272bf61](https://github.com/jackbuehner/cristata-api/commit/272bf614024ee15b4a6ffe64de582692b8707328))

### [2.5.3](https://github.com/jackbuehner/cristata-api/compare/v2.5.2...v2.5.3) (2022-04-03)


### Bug Fixes

* incorrect url format ([087d2cc](https://github.com/jackbuehner/cristata-api/commit/087d2cc4b7c314ede87eb8b4251bf1ccb0177ff3))

### [2.5.2](https://github.com/jackbuehner/cristata-api/compare/v2.5.1...v2.5.2) (2022-04-03)


### Bug Fixes

* hocuspocus client remaining connected when out of date ([d1e0c1f](https://github.com/jackbuehner/cristata-api/commit/d1e0c1f276e809c9ebdf6c4837de57bbff1a165c))

### [2.5.1](https://github.com/jackbuehner/cristata-api/compare/v2.5.0...v2.5.1) (2022-03-31)


### Bug Fixes

* array values with null prototype not converting to regular object prototype ([bdc3250](https://github.com/jackbuehner/cristata-api/commit/bdc3250a47b6014c2714d5c0ee63089ca69d960b))
* mongoose schema missing field when it is an array containing a schema ([e22663b](https://github.com/jackbuehner/cristata-api/commit/e22663bfea1ea27c67deb38f941a8a94afe7c2b5))

## [2.5.0](https://github.com/jackbuehner/cristata-api/compare/v2.4.0...v2.5.0) (2022-03-30)


### Features

* support configuring introspection ([64f536f](https://github.com/jackbuehner/cristata-api/commit/64f536f8ed2f40b8495f21227f7ad825436f613c))

## [2.4.0](https://github.com/jackbuehner/cristata-api/compare/v2.3.0...v2.4.0) (2022-03-29)


### Features

* **helpers:** remove helpers for pruning docs ([2387874](https://github.com/jackbuehner/cristata-api/commit/2387874543703384c728b472f77844118eb22f71))


### Bug Fixes

* **resolvers:** request non-lean document when docs need to be modified and saved ([b31a38a](https://github.com/jackbuehner/cristata-api/commit/b31a38a44a4d80492bb5ee3cd5d3fd6a0cd46a8a))
* use CollectionDoc type instead of LeanDocument type ([3c425d1](https://github.com/jackbuehner/cristata-api/commit/3c425d19438cb38cf9a780f75999d098247fa6d9))

## [2.3.0](https://github.com/jackbuehner/cristata-api/compare/v2.2.1...v2.3.0) (2022-03-29)


### Features

* **helpers/findDoc:** support finding doc and returnin as POJO or mongoose Document ([97680fc](https://github.com/jackbuehner/cristata-api/commit/97680fcca3c7522226f300121e28b12137924cab))


### Bug Fixes

* **helpers/findDoc:** missing return types ([d0db25e](https://github.com/jackbuehner/cristata-api/commit/d0db25e16ed8d81d613087fa36008d4ed95f4302))
* **helpers:** use non-lean docs when making changes that need to be saved ([8ecec20](https://github.com/jackbuehner/cristata-api/commit/8ecec204772c7d6f55b809dc867f642860206398))

### [2.2.1](https://github.com/jackbuehner/cristata-api/compare/v2.2.0...v2.2.1) (2022-03-29)

## [2.2.0](https://github.com/jackbuehner/cristata-api/compare/v2.1.3...v2.2.0) (2022-03-29)


### Features

* prefer to find newest doc based on created_at timestamp ([95755c2](https://github.com/jackbuehner/cristata-api/commit/95755c2eae8cd4d02d4800810fc1dc6b05998d66))


### Bug Fixes

* **helpers/canDo:** failure to return true when team matched action access ([c0bef61](https://github.com/jackbuehner/cristata-api/commit/c0bef61e70cd12de4fd9a7657c451736f51dcbd1))

### [2.1.3](https://github.com/jackbuehner/cristata-api/compare/v2.1.2...v2.1.3) (2022-03-28)


### Bug Fixes

* get teams that are string 0 or number 0 ([e4b1b20](https://github.com/jackbuehner/cristata-api/commit/e4b1b2041459dab02e5a24f73e27cc7731f241a8))
* improper toObject ([303694a](https://github.com/jackbuehner/cristata-api/commit/303694adf22b56b355b28f98d343a39edfe9242c))

### [2.1.2](https://github.com/jackbuehner/cristata-api/compare/v2.1.1...v2.1.2) (2022-03-28)


### Bug Fixes

* old code trying to convert mongoose doc to POJO ([484e894](https://github.com/jackbuehner/cristata-api/commit/484e894fcd0320dbbbbfda555c58fc3cb2f4ccea))

### [2.1.1](https://github.com/jackbuehner/cristata-api/compare/v2.1.0...v2.1.1) (2022-03-28)


### Bug Fixes

* old code trying to convert mongoose doc to POJO ([42cf417](https://github.com/jackbuehner/cristata-api/commit/42cf417fd40c7dc03f9cf5c21a3487ab44465c4d))

## [2.1.0](https://github.com/jackbuehner/cristata-api/compare/v2.0.5...v2.1.0) (2022-03-27)


### Features

* remove connection from context ([1351abc](https://github.com/jackbuehner/cristata-api/commit/1351abcbc114f2bce1ec598b7d5f2a54a894eb46))
* use aggregation for findDoc (like findDocs) ([b92b64d](https://github.com/jackbuehner/cristata-api/commit/b92b64dc70fb1363c0bc9ee71f806c7c7117ac5f))


### Bug Fixes

* use object id instead of hex string for any user ([6d1b9fa](https://github.com/jackbuehner/cristata-api/commit/6d1b9fac11b791af9a8f54091bbb258832f4ad09))

### [2.0.5](https://github.com/jackbuehner/cristata-api/compare/v2.0.4...v2.0.5) (2022-03-27)

### [2.0.4](https://github.com/jackbuehner/cristata-api/compare/v2.0.3...v2.0.4) (2022-03-27)

### [2.0.3](https://github.com/jackbuehner/cristata-api/compare/v2.0.2...v2.0.3) (2022-03-27)

### [2.0.2](https://github.com/jackbuehner/cristata-api/compare/v2.0.1...v2.0.2) (2022-03-27)


### Bug Fixes

* missing build step upon release ([ed3afb4](https://github.com/jackbuehner/cristata-api/commit/ed3afb4fd5ec2e7cdfcf8f063471aaefb56122be))

### [2.0.1](https://github.com/jackbuehner/cristata-api/compare/v2.0.0...v2.0.1) (2022-03-27)

## [2.0.0](https://github.com/jackbuehner/cristata-api/compare/v2.0.0-0...v2.0.0) (2022-03-27)


### ⚠ BREAKING CHANGES

* add managing editors default team
* collection permissions are no longer functions
* remove depreciated v2 apis (keep gh v2 apis)

### Features

* add ability for specified teams or users to bypass document permissions ([6e423ea](https://github.com/jackbuehner/cristata-api/commit/6e423ea069f5a99109075d327fe3e2beaabd4e2e))
* add applause support to articles ([e9b82bd](https://github.com/jackbuehner/cristata-api/commit/e9b82bd5ba9a1c2e087392151581fb6dc708f64a))
* add capitalization util ([4a43061](https://github.com/jackbuehner/cristata-api/commit/4a43061f55ca48e96ed59152007e66e87ba83bed))
* add custom queries ([4252ce9](https://github.com/jackbuehner/cristata-api/commit/4252ce92432c8b2a85b1e97715c4249adb65bebb))
* add entry point for package ([7472506](https://github.com/jackbuehner/cristata-api/commit/74725068bcc99504cb1e2f8a1ba91909800ab3cb))
* add helper for writing an email body ([1f1e843](https://github.com/jackbuehner/cristata-api/commit/1f1e8437c8d36dcbad0c9c6c14dfb2ce55d90b28))
* add managing editors default team ([d531f29](https://github.com/jackbuehner/cristata-api/commit/d531f29cdc049848ba6a0018f24d3bb46e66ef1c))
* add resolver generator ([4726136](https://github.com/jackbuehner/cristata-api/commit/472613645b5221098a12bb0b2e13da04443f2176))
* add schema generation ([66613ab](https://github.com/jackbuehner/cristata-api/commit/66613abb8a9d2281190bfebdeaa9eeff3aed4df7))
* add types to s3 query ([bd7aadf](https://github.com/jackbuehner/cristata-api/commit/bd7aadf68accab2b976fe22f82c3bb0caccc44f3))
* add util for checking if key in object ([31dc76c](https://github.com/jackbuehner/cristata-api/commit/31dc76c3b01234418271f7b9fddac225fdeb8eb5))
* allow find by slug without date field ([1bbf004](https://github.com/jackbuehner/cristata-api/commit/1bbf0049d72c97ad6df0a5fd602d2e4862a762df))
* automatically pluralize collection name in plural queries ([be27f53](https://github.com/jackbuehner/cristata-api/commit/be27f53dcff3c64eb6f7c9b2828c470f19c97d3c))
* collection permissions are no longer functions ([1119615](https://github.com/jackbuehner/cristata-api/commit/1119615d574490b185bfed4d168b67b0c70c1b27))
* delete doc without defining model ([c9fce5a](https://github.com/jackbuehner/cristata-api/commit/c9fce5a56441df4a1e067a3e50032a01b84f7c80))
* disallow constructor types as default values ([df48789](https://github.com/jackbuehner/cristata-api/commit/df487896ef39a109bc580f4a9ffd74d15baab2e8))
* enable fields that pull from other collection ([333ec72](https://github.com/jackbuehner/cristata-api/commit/333ec727e812ce10ca5fd99413378589e9937082))
* generalize custom resolvers to allow for any collection ([c9588a6](https://github.com/jackbuehner/cristata-api/commit/c9588a670673e40953446450ac8878d82862e272))
* **genSchema:** provide rules for public queries ([4984319](https://github.com/jackbuehner/cristata-api/commit/49843192fce18a10979882d9fc525fff1c4f2802))
* helper to generate colection config ([a077bb1](https://github.com/jackbuehner/cristata-api/commit/a077bb102ec67486f19e23d4313f40b5097251e2))
* include schemas in arrays to pruned types ([7593161](https://github.com/jackbuehner/cristata-api/commit/7593161f7ce062f508fedd44a818d65ce9ce4220))
* integrate default teams and users collections ([a3b23c6](https://github.com/jackbuehner/cristata-api/commit/a3b23c61a90f102b09c30e8d9293c20306ac9e7a))
* make config functionally available instead of via imports ([09feea3](https://github.com/jackbuehner/cristata-api/commit/09feea3c3fa03aecaa255cfb6db59b4d6ad3daaf))
* migrate most collections to use `genCollection()`, which generate schema, typeDefs, and resolvers from a single schema definiton ([2a1f074](https://github.com/jackbuehner/cristata-api/commit/2a1f0744e954f85862279c797b250000b96e55c9))
* migrate users collection to generator ([a10f435](https://github.com/jackbuehner/cristata-api/commit/a10f43519a36e48803b2302d97b991cc4aac5095))
* move articles collection custom queries and resolvers to generator input ([fce0db0](https://github.com/jackbuehner/cristata-api/commit/fce0db0485ffb1f7eff47a311af3001467ffc32e))
* move default teams to config ([18367e8](https://github.com/jackbuehner/cristata-api/commit/18367e86eedea5478b5ccc9c2047e1f4e39424e4))
* remove depreciated v2 apis (keep gh v2 apis) ([bf1b800](https://github.com/jackbuehner/cristata-api/commit/bf1b800134dce392c830f8344fc2973359cf1a9c))
* remove instance-specific files ([48280e2](https://github.com/jackbuehner/cristata-api/commit/48280e235a9b9b3242b1bb1acbfff656a7e17f1b))
* remove remaining parts of v2 API ([e88e26a](https://github.com/jackbuehner/cristata-api/commit/e88e26abf79a06ab60a0cfa9ea8ced8753006f49))
* remove Teams and Users enums ([cef26e7](https://github.com/jackbuehner/cristata-api/commit/cef26e76a64b4bc59e94dc0ca57d98815653ebf7))
* remove unused types from most collections ([8429918](https://github.com/jackbuehner/cristata-api/commit/84299188c579a91beaf3b530a00ae01d59530333))
* represent any team with 0 instead of '00000000000000000000000' ([351bf86](https://github.com/jackbuehner/cristata-api/commit/351bf8669c7022c5bc6aa372db2a60ea7a47d1ce))
* send http error 403 instead of redirect to /auth ([32d771e](https://github.com/jackbuehner/cristata-api/commit/32d771e3ba2e03484bc6064e60f64be1fbf1beb3))
* serialize Float scalar as Decimal128 (and deserialized as Float) ([6ea3801](https://github.com/jackbuehner/cristata-api/commit/6ea380154de4a07718ab4d1f32a53939a717b915))
* set counter on all docs after they have synced with database ([a84672c](https://github.com/jackbuehner/cristata-api/commit/a84672cd915ab93454864664b5b229feecf9a2fe))
* sign out via POST ([6477fbf](https://github.com/jackbuehner/cristata-api/commit/6477fbf9b730fae0c4defd0a78446b7b85be531a))
* support array with schema inside as schema type ([e5bfb0b](https://github.com/jackbuehner/cristata-api/commit/e5bfb0bccc7edfef9783fae532cc13964e5c9abb))
* support conditional setters for fields ([615cdb8](https://github.com/jackbuehner/cristata-api/commit/615cdb8781124e6ad858d28381df7e4293f16d74))
* support cookies separated by semicolon and white space ([4a09dd5](https://github.com/jackbuehner/cristata-api/commit/4a09dd51fb53e78274a04bd0cf6a07ba144d9cbd))
* support custom increment mutations ([fe322ed](https://github.com/jackbuehner/cristata-api/commit/fe322ed60a240accd96fadbb832fc8fe6185df34))
* support disabling specific resolvers ([a4ebbaf](https://github.com/jackbuehner/cristata-api/commit/a4ebbaf4353880868557aa157ac0071d509134ee))
* support existing type for custom query return type ([4ae1bea](https://github.com/jackbuehner/cristata-api/commit/4ae1bea5ebb53603bec5947a92af5b57b3355610))
* support field names as permissions values ([904ecc5](https://github.com/jackbuehner/cristata-api/commit/904ecc5923e6d29eb4495e7fde137bb254bbeffa))
* support json schema for collection config ([8e7a590](https://github.com/jackbuehner/cristata-api/commit/8e7a590da1b8064307e04ed59019cd94a7ce1e0b))
* support modify function in createDoc ([bbe1ce7](https://github.com/jackbuehner/cristata-api/commit/bbe1ce70b77cc2cbecae01f74a061cad5048d95b))
* support providing database collections in the config as type GenCollectionInput in addition to type Collection ([cfed710](https://github.com/jackbuehner/cristata-api/commit/cfed7108ccf6cf0ed3b625d367d30a9ee468a0f8))
* support public custom queries ([85e7cf0](https://github.com/jackbuehner/cristata-api/commit/85e7cf06ecfa8b7d71a8be9ad62cf6c2acf73428))
* support public satire api queries ([6bc8da0](https://github.com/jackbuehner/cristata-api/commit/6bc8da0c9f0d5857213765dcae04f9f51912f3ca))
* support regex input rules ([c1e9046](https://github.com/jackbuehner/cristata-api/commit/c1e904671593568e3be1899a97290f97dcadfaa6))
* support selecting path from custom query aggregate to send ([3b64bd1](https://github.com/jackbuehner/cristata-api/commit/3b64bd18fb0e90f8ee6b458ea94e564cbe916a69))
* support stage email updates ([bfdacf2](https://github.com/jackbuehner/cristata-api/commit/bfdacf20130789594310d033f57092968cfd97f3))
* support string representations of mongoose schema types ([07941aa](https://github.com/jackbuehner/cristata-api/commit/07941aa7b8667f0f8d5dd4b2c6c506f3001ba177))
* support tenant path ([e1086a6](https://github.com/jackbuehner/cristata-api/commit/e1086a6ecea295f3abc42e041d069111aa1e7d2b))
* support using team slugs in collection permissions ([9b8d3c1](https://github.com/jackbuehner/cristata-api/commit/9b8d3c1d46e09095567a3912d6ce5e2a4f2da0df))
* switch to string types instead of constructors ([27b7f95](https://github.com/jackbuehner/cristata-api/commit/27b7f957428fd84b55513da6a0a18fa9d90efe5a))
* uncapitalize collection name in resolvers instead of making collection name lowercase ([0729fc6](https://github.com/jackbuehner/cristata-api/commit/0729fc62e0b0c9ad17fb8770cd3b1139e8662ed0))
* use db_2 as default db when not in .env ([b674732](https://github.com/jackbuehner/cristata-api/commit/b674732bfbe6fa0b829ed34869f11128c642e190))
* use float/double instead of decimal128 type ([0fb9ca1](https://github.com/jackbuehner/cristata-api/commit/0fb9ca1bb2a46c08a2a9e24e664354856d21beb8))
* use hex string instead of object id for teams action access ([4bbf930](https://github.com/jackbuehner/cristata-api/commit/4bbf93027456e876960a5155abd2d65cdd49ab1f))
* use newest collection generator features ([ffc616b](https://github.com/jackbuehner/cristata-api/commit/ffc616b1e68a29a1142011e3430cbe1eee6e41a2))
* use team id and names instead of enum ([39c6122](https://github.com/jackbuehner/cristata-api/commit/39c6122fc84800a75992a448361c09ff0253059b))


### Bug Fixes

* broken comparison to client version ([31fbe5a](https://github.com/jackbuehner/cristata-api/commit/31fbe5a422fd6905b9e89fede0397d29e0e1cfd8))
* **canDo:** user ids not properly compared because they were objects ([16ff3d4](https://github.com/jackbuehner/cristata-api/commit/16ff3d43e026573478412801845bcdf6c3c376a0))
* crash when custom resolver field value is unexpectedly not an array ([d731bac](https://github.com/jackbuehner/cristata-api/commit/d731bacf0d3a35221113921a3996196ee766efca))
* custom permissions not extended by CollectionPermissions ([b216609](https://github.com/jackbuehner/cristata-api/commit/b21660907368d09b76cfa77dfb2977a8b461abeb))
* custom resolvers not generated for pruned types ([48f84e4](https://github.com/jackbuehner/cristata-api/commit/48f84e456dace5b73021cc83bda03b7b823fd6f6))
* empty string not valid when string is required ([cc5b0cb](https://github.com/jackbuehner/cristata-api/commit/cc5b0cb56cfe7dcce1382d1e88b9323153fef784))
* error in custom resolver when value is undefiend ([5c13571](https://github.com/jackbuehner/cristata-api/commit/5c135718d7a4b246046bcda932460b394400dd87))
* error thrown in opposite condition ([2bdc994](https://github.com/jackbuehner/cristata-api/commit/2bdc994f0175b87b3f23a12b90a68f6817d1ff11))
* error trying to add photo credit ([b430751](https://github.com/jackbuehner/cristata-api/commit/b4307514ba6ac045416f630d3ad119ff3c7b8511))
* error when custom query accepts no args ([9b51ea1](https://github.com/jackbuehner/cristata-api/commit/9b51ea193cb6b261c4c95987dc5fe8fb0169a5e1))
* error when doc is null ([979f333](https://github.com/jackbuehner/cristata-api/commit/979f333e8f45344116cb2816542342241e987afe))
* error when objectid is stored as hex string the database ([2bd8c48](https://github.com/jackbuehner/cristata-api/commit/2bd8c48758cb4cd7560ff2b21fb182fdd6de9306))
* error when referenenced doc is not found ([d64e09a](https://github.com/jackbuehner/cristata-api/commit/d64e09ab58ec0c81eff1ff7a5e30b7753cc4bf0f))
* failure to start server from invalid mongoose schema types ([8caf0ce](https://github.com/jackbuehner/cristata-api/commit/8caf0cea13bb78482a7e1a2fe7fd787e557adc65))
* full access to getting photos is denied ([a001a01](https://github.com/jackbuehner/cristata-api/commit/a001a0161c0b96c0094716c67b55a679b7a14632))
* incorrect cookie path when no TENANT ([5fb1d94](https://github.com/jackbuehner/cristata-api/commit/5fb1d9486cc0cb65a7469c6e115b5ff19e71eb76))
* incorrect stage type ([a0f86c8](https://github.com/jackbuehner/cristata-api/commit/a0f86c8f41e2cfd043b7d04b10d02ebd10ff042c))
* incorrectly merged input permissions type ([1b5d8c1](https://github.com/jackbuehner/cristata-api/commit/1b5d8c1abd3fdaaa87c067ce45aa8cda166cf6dd))
* missing access to docs with Teams.ANY team ([fd5639c](https://github.com/jackbuehner/cristata-api/commit/fd5639c4a32a56aa6ac226f52bc58b5c6802b0cd))
* missing fields in pruned timestamps type ([30e9c00](https://github.com/jackbuehner/cristata-api/commit/30e9c001791f7dfb28b9c206541fb9c182c1dd29))
* missing optional doc _id parameter for action access ([eae7650](https://github.com/jackbuehner/cristata-api/commit/eae7650f6b3e0006495a242e2385a83b55a2ceec))
* missing origin limitations on proxy ([f91ff1e](https://github.com/jackbuehner/cristata-api/commit/f91ff1e07dc1a6af122c116fd48327ba4da67018))
* ObjectId instance not considered an ObjectId ([11158da](https://github.com/jackbuehner/cristata-api/commit/11158da32719f11d796d091aa21b92e0cf592afb))
* passport mongoose user strategy not used ([84cab67](https://github.com/jackbuehner/cristata-api/commit/84cab67eb31b4691442e2a6a370038107d10e2cb))
* people resolvers missing ([be371a2](https://github.com/jackbuehner/cristata-api/commit/be371a2510ff6d32c22918313dd8d11edb7f077f))
* poor parsing of cookies because expected space after semicolon ([76d2d5f](https://github.com/jackbuehner/cristata-api/commit/76d2d5f27bce87d154baa36633bfedd30f6fe831))
* publish resolver key defined even when !canPublish ([b1aa9bf](https://github.com/jackbuehner/cristata-api/commit/b1aa9bf6d4498e41a513b877fa03c89dffe611ad))
* subscription resolvers always included ([6496bb7](https://github.com/jackbuehner/cristata-api/commit/6496bb73d1fb367c1be62b31a167566b526cc877))
* **typedefs:** return the document instead of void ([ff5a79d](https://github.com/jackbuehner/cristata-api/commit/ff5a79dcbe564572be459f881e75f1df514ad200))
* unable to modify array of subdocuments ([a25be07](https://github.com/jackbuehner/cristata-api/commit/a25be07f690844a22523a645860a30913f276488))
* use Float instead of Int for phone to handle larger numbers ([4c07672](https://github.com/jackbuehner/cristata-api/commit/4c0767230b445c655f20b878de15bd06d1752a10))

## 2.0.0-0 (2022-02-21)


### ⚠ BREAKING CHANGES

* export Cristata as default
* use object id (_id) instead of github id (github_id)
* require auth for websocket connections

### Features

* accept partial data in patch model ([446fae6](https://github.com/jackbuehner/cristata-api/commit/446fae6a101bc57c8d742359edf34893871a000f))
* add a private CORS proxy ([52bee89](https://github.com/jackbuehner/cristata-api/commit/52bee89c2f78b603bf340c0f0f7c82205793fb83))
* add apollo graphql ([649a049](https://github.com/jackbuehner/cristata-api/commit/649a049f02f560ee1847c38faa7a0d0cadf84842))
* add core schema with suport for additions from the config ([76088fe](https://github.com/jackbuehner/cristata-api/commit/76088fe7af4800e3c9e40f8f159f5ec33c767f3a))
* add interface for collection schema fields ([503d0e2](https://github.com/jackbuehner/cristata-api/commit/503d0e27c938f2985b871bfbd11c39ef33bc5094))
* add layout property to articles ([9e7e205](https://github.com/jackbuehner/cristata-api/commit/9e7e205c191713fb4e32eea746d4f3ae66aeb9d3))
* add legacy fields to collections ([c03f13d](https://github.com/jackbuehner/cristata-api/commit/c03f13d2922aa925f7f6b5a4da513d3ca59eddee))
* add new user photo endpoint ([ae22a07](https://github.com/jackbuehner/cristata-api/commit/ae22a0717485cba894cc5a30abd1123ad637a767))
* add pagination to aggregation of generated mongoose collections ([f5addb6](https://github.com/jackbuehner/cristata-api/commit/f5addb6d1e24c86efe515dd040308346b6e1bafd))
* add permissions to db config ([33ad7dc](https://github.com/jackbuehner/cristata-api/commit/33ad7dcaf6ed080d57e2e99295c61263b812971b))
* add public flushes query ([8f54bca](https://github.com/jackbuehner/cristata-api/commit/8f54bcafd1b6432c67a0db354b770e2e688696e6))
* add queries for when a user exists and how a user can login ([df25b59](https://github.com/jackbuehner/cristata-api/commit/df25b59a643e0d040f276288859737b8277ed5be))
* add query for users not assigned to any teams ([83ad153](https://github.com/jackbuehner/cristata-api/commit/83ad153d89b38244c035f617c9752e80ae3a8875))
* add relations to users ([7efe795](https://github.com/jackbuehner/cristata-api/commit/7efe795c3cb9ec617dbccbadb05eb40df5de69db))
* add teams collection to the database and api ([6d8d296](https://github.com/jackbuehner/cristata-api/commit/6d8d296f71398080fb2b9cb83183cce88c909b97))
* add template to article schema ([520ec38](https://github.com/jackbuehner/cristata-api/commit/520ec3849ce4b46e5e440734870d393e00383e5a))
* add The Royal Flush routes and models ([38176bd](https://github.com/jackbuehner/cristata-api/commit/38176bd92631302b171da833a04d2a316ffcb788))
* add util to return date with extra time removed ([35dfa22](https://github.com/jackbuehner/cristata-api/commit/35dfa2205928db23b1a6eea33da8cef0fb6cdb95))
* add v3 collectionActivity query ([1d4b3d4](https://github.com/jackbuehner/cristata-api/commit/1d4b3d4d54db00a26b60dd2cd8eba060dd89a422))
* allow api origins ([8e896da](https://github.com/jackbuehner/cristata-api/commit/8e896da3e3970fa8cf323dc23a1395903c72a2ae))
* allow changing permissions ([90676b4](https://github.com/jackbuehner/cristata-api/commit/90676b4b61f6cdc3fc5f9d9baf987fd3d9a00dde))
* **apollo:** log errors to server console ([81df69f](https://github.com/jackbuehner/cristata-api/commit/81df69f3a8572d82a11f254ffd86cd7d4ef6e193))
* **articles:** bring back auto slug and email notifications ([3f0ff03](https://github.com/jackbuehner/cristata-api/commit/3f0ff03e3552d06dd033ae2702fad7518261f2ce))
* build mongoose schema subobjects as subdocs ([130bb35](https://github.com/jackbuehner/cristata-api/commit/130bb3523cb683a0fb8a90c504e27d04c677e0f1))
* configure cors for apollo ([8895802](https://github.com/jackbuehner/cristata-api/commit/889580204bee787c3f1881f78d84034a3b17ac57))
* convert hex id strings to object ids ([f1ea93b](https://github.com/jackbuehner/cristata-api/commit/f1ea93be3aecda1b6ebfc487b49d593c9573f41a))
* convert iso dates in JSON scalar into js dates ([96c199e](https://github.com/jackbuehner/cristata-api/commit/96c199e3bace2fd64c9de6adb35c9a8971062f10))
* create mongoose schemas and models from the config ([14ea881](https://github.com/jackbuehner/cristata-api/commit/14ea881b04bd73a13795ea48c50110df26bb09be))
* **createDoc:** always give current user permission to edit the document they create ([dbacf6d](https://github.com/jackbuehner/cristata-api/commit/dbacf6ddebeb2831c5a47b9a3ab7f98526dd468f))
* **db:** add more teams ids ([a549937](https://github.com/jackbuehner/cristata-api/commit/a5499372e6527f32d26eae6fb0a884c08f901027))
* **db:** do not add _id to auto-generated schemas ([b5fb52e](https://github.com/jackbuehner/cristata-api/commit/b5fb52e95e00622191836b3dde637622660c8e0f))
* deny permission when account has next_step ([179b099](https://github.com/jackbuehner/cristata-api/commit/179b0992f754fcdbd51c553b91abd9cb4a3e37a3))
* **deps:** update axios and mongoose ([2645473](https://github.com/jackbuehner/cristata-api/commit/26454735a0766512ed1dd687da8d50691f8e0d37))
* enable detailed teams data for users in graphql api ([44f448d](https://github.com/jackbuehner/cristata-api/commit/44f448d5322688f5b63ab367f88a3e65a6401eb0))
* enable finding a public article by slug and optional date ([c10d3af](https://github.com/jackbuehner/cristata-api/commit/c10d3afd35c7d320acecc05fb10d49709f167159))
* enable getting user usernmae ([fd0214e](https://github.com/jackbuehner/cristata-api/commit/fd0214eaad38616b23a999d40b22d3a6335bf639))
* enable optional filters on findDoc helper ([5835521](https://github.com/jackbuehner/cristata-api/commit/583552170dca22e53f8ff729da5bb4871a9d37c5))
* enable sign in with local account or github account ([621743d](https://github.com/jackbuehner/cristata-api/commit/621743df2ef7228053852517f7cb227fb2f9b140))
* enable text compression for responses ([b7d5218](https://github.com/jackbuehner/cristata-api/commit/b7d5218a75c71d37d5d1c9d164dc39f66387a4f4))
* export  users prune keep array ([e133796](https://github.com/jackbuehner/cristata-api/commit/e133796c96fcbfd96723faf3f7b338ad658ae847))
* export collection people resolvers ([57ae26b](https://github.com/jackbuehner/cristata-api/commit/57ae26b76d42da2f14b1d6a4621875acab146198))
* export Cristata as default ([3ba8a01](https://github.com/jackbuehner/cristata-api/commit/3ba8a01a01c6dee9385f0ab3675b5512ae7422d8))
* export pruned article keep keys constant ([e678c02](https://github.com/jackbuehner/cristata-api/commit/e678c025044d0881986ceda2d66425783403a492))
* filter and match by whether timestamps are baseline times ([b023a3d](https://github.com/jackbuehner/cristata-api/commit/b023a3d9ce09aec9c57a212057ff667038c91c89))
* find doc by an alternate field (not _id) ([2e42ddb](https://github.com/jackbuehner/cristata-api/commit/2e42ddb9fafd6c15e5b62f3daaacbf88fa8cc087))
* find shorturls by code instead of by _id ([c7fd5a1](https://github.com/jackbuehner/cristata-api/commit/c7fd5a1f8c28f4310d57b7f412d8e6079bbb73a4))
* **findDocs:** allow docs with Users.ANY in permissions to be accesible to any authenticated user ([201f53b](https://github.com/jackbuehner/cristata-api/commit/201f53b27293961165d2f9491ac7b3d56ccc3be4))
* **findDocs:** support extra pipeline ([c739d78](https://github.com/jackbuehner/cristata-api/commit/c739d7811eaefeeafdff6e76dc5d54b993847309))
* force social media team ([4e9007e](https://github.com/jackbuehner/cristata-api/commit/4e9007e847b8707e9883c0281e6c1233e1f724bb))
* func to check whether variable is ISO date string ([6a48cda](https://github.com/jackbuehner/cristata-api/commit/6a48cda047f97512ad053ac1c0177a22bce8a476))
* function to check whether variable is object ([3737b20](https://github.com/jackbuehner/cristata-api/commit/3737b20f2ce0f374ed7dfe26ae462af9b2ce050d))
* function to convert ISO dates anywhere in object to js dates ([55aa46d](https://github.com/jackbuehner/cristata-api/commit/55aa46daa1a2797dac9056cad7061bac6effe45d))
* function to parse cookie header ([7686c1b](https://github.com/jackbuehner/cristata-api/commit/7686c1be65e69afaebe90ad531b0dffd5fecc124))
* function to split string only once ([f0ee09a](https://github.com/jackbuehner/cristata-api/commit/f0ee09a9590d526f08c38974bf1e13a8b61b820e))
* get list of article tags and categories ([3a3457b](https://github.com/jackbuehner/cristata-api/commit/3a3457b1fcca71ea5c62dce19c89a1771ea43bb9))
* **gql:** add findDocs helper function to retrieve paginated docs ([9b50fed](https://github.com/jackbuehner/cristata-api/commit/9b50fedab482e2aa827122348cedf477f8980419))
* **gql:** add generic Paged type for paged responses ([3698bbf](https://github.com/jackbuehner/cristata-api/commit/3698bbf8881444a20c75950c8025ed06883c93d4))
* **gql:** add helper and type for collection action access ([1e3e507](https://github.com/jackbuehner/cristata-api/commit/1e3e5071e4ad0ca88d06b7605fbb5337cc37e7a0))
* **gql:** add helper to send payload to subscriptions when mutation occurs ([f2fbb72](https://github.com/jackbuehner/cristata-api/commit/f2fbb720d814a8873b3bc23c6eba0b7b606cdf91))
* **gql:** add helpers for pruning document contents ([50389a9](https://github.com/jackbuehner/cristata-api/commit/50389a9f28bc15ee2843c2c49b4a068c4c0627e0))
* **gql:** add helpers to perform common actions on mongoose documents ([1da43b6](https://github.com/jackbuehner/cristata-api/commit/1da43b68265153662de257c6db1b91224b14e993))
* **gql:** add json scalar type ([87204f4](https://github.com/jackbuehner/cristata-api/commit/87204f4a93aabb61c6fba1fc174dd265a68266f3))
* **gql:** add option to allow finding docs using the helpers without authentication ([fcec413](https://github.com/jackbuehner/cristata-api/commit/fcec413bfb5bf7c80b8e659a91ca077de826e5ea))
* **gql:** add publishing logic ([f394937](https://github.com/jackbuehner/cristata-api/commit/f39493764d14aeb9dcbdd6e6574a1e18b2f8f21e))
* **gql:** add void scalar type ([aa02c99](https://github.com/jackbuehner/cristata-api/commit/aa02c99d688da4ae2b7229990f9b25b33d0e6f28))
* **gql:** include config in context ([39933a6](https://github.com/jackbuehner/cristata-api/commit/39933a6939cff42e0d0eb88013d7f3f0de32b95e))
* **gql:** move authentication check to a helper to be used in resolvers and other helpers ([6c7a3c6](https://github.com/jackbuehner/cristata-api/commit/6c7a3c657fd4d708e38c9a08bcda03e431fa0b59))
* **gql:** replace user id with user type in history array ([f0a9f13](https://github.com/jackbuehner/cristata-api/commit/f0a9f131c29160e742261b195b01f6e064e9fe2f))
* **gql:** support nested objects when specifying keys to keep when pruning a doc ([a3f51f1](https://github.com/jackbuehner/cristata-api/commit/a3f51f1aa72e4f3442729717c5288927cd3beb35))
* **gql:** support subscriptions ([c346c9b](https://github.com/jackbuehner/cristata-api/commit/c346c9b81b527e196edba7b8492d82b7da7bfff2))
* **gql:** unify helper functions into consistent parameter format ([1a9eade](https://github.com/jackbuehner/cristata-api/commit/1a9eade668cd2ff29236c614ae7e4ee37f186b68))
* isolate config from rest of server ([cefe9d6](https://github.com/jackbuehner/cristata-api/commit/cefe9d6c3989058495f017b5fb1f7f905fbfd777))
* make article authors and primary editors mandatory watchers ([4b05d8a](https://github.com/jackbuehner/cristata-api/commit/4b05d8aed568c31a8c62ca39a3b6abdfd4cc6033))
* **modifyDoc:** support fullAccess arg (like findDoc) ([4f4c1e2](https://github.com/jackbuehner/cristata-api/commit/4f4c1e28e74deb075164074e68bbc8fa69c0039f))
* move collections to config ([3e0c4b7](https://github.com/jackbuehner/cristata-api/commit/3e0c4b79c8a364886b2345829ce350b9f114ef03))
* only include publish people and timestamps on collections that can be published ([445e10d](https://github.com/jackbuehner/cristata-api/commit/445e10d464eeb363431c71b0673d040ba5813ef4))
* **pruneDoc:** convert doc to lean doc before flattening ([a3237b5](https://github.com/jackbuehner/cristata-api/commit/a3237b527c3944887c383ddc0a45979163ca9eeb))
* pull photo_credit from photos collection for articles ([cb762c9](https://github.com/jackbuehner/cristata-api/commit/cb762c927782c01e3a4d84a939074b967e2f28b0))
* **qgl:** ability to include permissions to collection type ([e1c778e](https://github.com/jackbuehner/cristata-api/commit/e1c778e16378fbc57cd794110ab075681c4524bf))
* remove redundant permissions ([d346812](https://github.com/jackbuehner/cristata-api/commit/d3468121c460b78aa982d37a3e09e357966d44a3))
* remove unused history endpoint ([53a1277](https://github.com/jackbuehner/cristata-api/commit/53a12777369cb5d1b514c3560979d07c799fbbd1))
* require auth for websocket connections ([4eea347](https://github.com/jackbuehner/cristata-api/commit/4eea3479b55b25c4324c509735c8be58c79af22d))
* return _id of deleted doc ([09cf590](https://github.com/jackbuehner/cristata-api/commit/09cf590813e00ab507ea02f17a8862d5768bb6f0))
* **satire:** allow all managing editors to view all satires ([69d7663](https://github.com/jackbuehner/cristata-api/commit/69d76637d70ab8174b837f6a50e58433cad31f8e))
* save [@thepaladin](https://github.com/thepaladin).news or [@furman](https://github.com/furman).edu email to profile ([32bc5fb](https://github.com/jackbuehner/cristata-api/commit/32bc5fb5c584c693db144d0c1132a0ddde214ba1))
* send fathom url with pasword to admins ([eaa8e26](https://github.com/jackbuehner/cristata-api/commit/eaa8e265a48dbe384fc324eb542e6934d0d01fcc))
* send full profiles instead of user ids ([3d51251](https://github.com/jackbuehner/cristata-api/commit/3d51251983b5ea75d877228b8d3247d9b3fdf3b6))
* **sendEmail:** always append 'Powered by Cristata' message to emails ([70ddb34](https://github.com/jackbuehner/cristata-api/commit/70ddb340621c961e1429672e32398cdc33364f09))
* **settings:** allow querying for setting objectId ([d05d715](https://github.com/jackbuehner/cristata-api/commit/d05d71567188f1b4705c8a110e625aedb601f01e))
* **settings:** merge new setting into old setting instead of replacing old setting with new setting ([641184d](https://github.com/jackbuehner/cristata-api/commit/641184d9b114bf2d8b8d7bdfe8fccfdd4c096528))
* **settings:** only require JSON to modify ([1e28437](https://github.com/jackbuehner/cristata-api/commit/1e284374952eac1d6952cae0ad3749232c08beec))
* simplify database config structure ([31300f5](https://github.com/jackbuehner/cristata-api/commit/31300f53e3daafa81106669ca0ab16db9a67b171))
* **slugify:** support custom replacement ([d024bc5](https://github.com/jackbuehner/cristata-api/commit/d024bc567ebec2d22d1a04bb226691fcb1d68436))
* sort photos with newest first ([6d1862e](https://github.com/jackbuehner/cristata-api/commit/6d1862edc2af36a7d45ed41703f02d25eaf8123c))
* stage counts for articles and satire ([a5fd6b5](https://github.com/jackbuehner/cristata-api/commit/a5fd6b5d655719fcc0258dc8fad3efaea51f8111))
* support conditional permissions ([2affe58](https://github.com/jackbuehner/cristata-api/commit/2affe58d2620fe821906992f53cc9250527dcaa7))
* support custom access rules for finding docs ([a7f23d9](https://github.com/jackbuehner/cristata-api/commit/a7f23d9c61765c57d93803b6e01b9da2e1d39e6c))
* support getting article editors publicly ([53c2ee5](https://github.com/jackbuehner/cristata-api/commit/53c2ee56c4c950f671f8040005adfa36e51acc14))
* support getting featured articles ([bd2974c](https://github.com/jackbuehner/cristata-api/commit/bd2974c3c6cb64e7915e8e2fd472c9e47d16ba6e))
* support local mongodb connections ([ecc6151](https://github.com/jackbuehner/cristata-api/commit/ecc61510069ba5410fb11637e5427b6678dbcb7c))
* support parsing ISO dates inside arrays ([48ee50e](https://github.com/jackbuehner/cristata-api/commit/48ee50eb8ef1de690724b701788f7a1e9465a309))
* support querying public user by slug ([77a4765](https://github.com/jackbuehner/cristata-api/commit/77a4765bb8c3e604b5a1a310a78c99f2a84a5dd3))
* support storing external accounts ([9aeab9b](https://github.com/jackbuehner/cristata-api/commit/9aeab9b85d9e0a098a7b3f8baa7c2dbaa8ebc494))
* switch Cross-Origin-Resource-Policy to same-site ([a97b7ea](https://github.com/jackbuehner/cristata-api/commit/a97b7ea504154f966699c72b9433746a00bbe88f))
* **teams:** allow organizers to delete team ([fcd3298](https://github.com/jackbuehner/cristata-api/commit/fcd3298c64a0b365e1e29790b616908532beb09d))
* **teams:** move access rules to permissions function ([573a0e7](https://github.com/jackbuehner/cristata-api/commit/573a0e739604e2c114e99136a38ae389341c492b))
* **teams:** reveal team data to any authenticated user ([04176d9](https://github.com/jackbuehner/cristata-api/commit/04176d9ac9fca845edb6d0b13c4ff8d897ad2b69))
* throw appropriate error when doc to hide cannot be found ([acadfa9](https://github.com/jackbuehner/cristata-api/commit/acadfa90f58191c2fd5e1ac70bbf3479286de0c7))
* use a same deseralize user function for login ([330c682](https://github.com/jackbuehner/cristata-api/commit/330c682677bc33bf7f5e634d6532c4695e757de3))
* use api v2 on /v2 and /api/v2 ([6d0188d](https://github.com/jackbuehner/cristata-api/commit/6d0188d0b622a5e52c45816c8939de914fd70c9f))
* use better default permissions ([7d10327](https://github.com/jackbuehner/cristata-api/commit/7d103278a6beb964bff4316068fa7e51de36d7cc))
* use better language is email to watchers ([c2dea74](https://github.com/jackbuehner/cristata-api/commit/c2dea7457535a2c09ed1ac14692d30b374122e5d))
* use helmet to prevent vulnerabilities ([34fc319](https://github.com/jackbuehner/cristata-api/commit/34fc31960449c63f0c52e2c1f0cdff3fc3511b50))
* use object id (_id) instead of github id (github_id) ([5266237](https://github.com/jackbuehner/cristata-api/commit/52662374fa35692bf4dcfddabdfb67bb5399a38f))
* use teams from db instead of from github ([9ddd103](https://github.com/jackbuehner/cristata-api/commit/9ddd10342949c11ea3ff8d4565c6714e27f9bf5e))
* **user-photo:** pipe the request to the photo url ([0870e10](https://github.com/jackbuehner/cristata-api/commit/0870e106e3df58a4af51fa2ef85db08d86110aca))
* **users:** add ability to migrate to create username and password for users that only sign in with GitHub ([2b7f6d6](https://github.com/jackbuehner/cristata-api/commit/2b7f6d667ce7f2b0a10ee5ab03c5909797ebdc59))
* **users:** add userResendInvite query ([28a1922](https://github.com/jackbuehner/cristata-api/commit/28a1922235a09e734940f3aa84ece19244aacb99))
* **users:** enable creating new users with temporary passwords and changing user passwords ([c4aa8f5](https://github.com/jackbuehner/cristata-api/commit/c4aa8f5da089534b15740222a7b1de033f1e0b9f))
* **users:** enable deactivate (retire) a user ([6b6d95f](https://github.com/jackbuehner/cristata-api/commit/6b6d95f939bb610e70e13373129bd26eb26fae51))
* **users:** one-click account actvation login ([d36da2d](https://github.com/jackbuehner/cristata-api/commit/d36da2d574c8ff92538f7c6948762651de8031ae))
* **users:** only allow normal users to modify themselves. ([7df3b30](https://github.com/jackbuehner/cristata-api/commit/7df3b305ae8e0fa6559bcf2ce0a02ce34e9ea979))
* **users:** use local teams instead of GitHub teams ([a09cd42](https://github.com/jackbuehner/cristata-api/commit/a09cd42ab3ead21706668e9b47667e5a5e672a37))
* util to flatten objects ([bb09bf0](https://github.com/jackbuehner/cristata-api/commit/bb09bf09c850534c817cc711f6eee7a39b6c8c58))
* **v3:** add query to get a signed s3 url ([75abae8](https://github.com/jackbuehner/cristata-api/commit/75abae802177e83fa42855763619d155b2ba3786))
* wrap everything in try catch blocks ([cf5679d](https://github.com/jackbuehner/cristata-api/commit/cf5679da9e1ebfcdec0240a08d8386e66d13c811))


### Bug Fixes

* `article_id` schema field should be ObjectID instead of String ([eb3b59c](https://github.com/jackbuehner/cristata-api/commit/eb3b59cbbbde3ee4bcd8cfcdd849bf9696e38010))
* add slug when publishing satire ([291f4cb](https://github.com/jackbuehner/cristata-api/commit/291f4cb068fa894717e9a2510ab39b1a754b24ff))
* aggregation ignoring filters and ids ([7f648e4](https://github.com/jackbuehner/cristata-api/commit/7f648e4d80c107c400d895cd8191a8c4b2e24ece))
* agregation pipline relations ([b06fb41](https://github.com/jackbuehner/cristata-api/commit/b06fb4158285002b0be671e6e7d69f834085d87b))
* allways return array when handling pruned people ([c84ec70](https://github.com/jackbuehner/cristata-api/commit/c84ec707589cf8a611244ebffed3f7764934006e))
* **articles:** use ObjectID instead of Int for modify input ([017c0c9](https://github.com/jackbuehner/cristata-api/commit/017c0c9d394749ae5eb00361af36551d7806d3b5))
* broken object ids after iso to date function ([193dd1f](https://github.com/jackbuehner/cristata-api/commit/193dd1f90ce71a157ba1900dd8130cca0546e461))
* broken playground due to csp ([41f59bf](https://github.com/jackbuehner/cristata-api/commit/41f59bfa72ea871fae70c90bdf33118b28f2003b))
* cannot get article to hide ([4f7caff](https://github.com/jackbuehner/cristata-api/commit/4f7caffaf78e77c19a7aa6f16e5e5529ba8ad88d))
* changes to existing profile docs not saving ([4417258](https://github.com/jackbuehner/cristata-api/commit/44172585434d1b73bee16cc21434757aa05f8376))
* **CollectionActionAccess:** enable querying deactivate, which is available for the user's collecion ([0be2833](https://github.com/jackbuehner/cristata-api/commit/0be28331bfa7d82b27fe980c2e3333124fcd6948))
* collectionActivity name should be optional (not all collections have a name field) ([b44ce7b](https://github.com/jackbuehner/cristata-api/commit/b44ce7bedb9bdce64f5665345c82132e645a6bd0))
* comparison of hex to objectId ([8686d16](https://github.com/jackbuehner/cristata-api/commit/8686d163d88e06ba75d819f490a7c2fa2c80db55))
* completely wrong schema for flush documents ([487e8f0](https://github.com/jackbuehner/cristata-api/commit/487e8f07a1eb6147b23b516d0fa4cffba266f33b))
* convert default id to objectId instead of integer ([10e6985](https://github.com/jackbuehner/cristata-api/commit/10e69854afdb91f20814497a15ba143f9f14b729))
* convert profile id to integer ([8662eca](https://github.com/jackbuehner/cristata-api/commit/8662eca634dbb6e55f8a4a6d60dbcaa6bc567441))
* correctly merge new and old data when modifying doc ([12cebba](https://github.com/jackbuehner/cristata-api/commit/12cebba94849b124fa874d07896a59dae1842020))
* crash when piping to nonexistent photo url ([6e98a56](https://github.com/jackbuehner/cristata-api/commit/6e98a56ff671d505a82fa1769d042d1c0fd2db7a))
* crash when user.methods is not defined ([fd4cd64](https://github.com/jackbuehner/cristata-api/commit/fd4cd64a4e9c13c4ed885e22c0c7f15374710a78))
* disable user login when the user is disabled (retired) ([442d375](https://github.com/jackbuehner/cristata-api/commit/442d375aa468bf8543db935ee58827960bc3cbba))
* do not check standard permissions when collection does not have standard permissions enabled ([e94a5a9](https://github.com/jackbuehner/cristata-api/commit/e94a5a9a4bca5ee2f31525cc911a137f0c619fbd))
* don' try to convert schema into a schema - it is already a schema ([9a8e1ec](https://github.com/jackbuehner/cristata-api/commit/9a8e1ec27a9b337ce3058b0062b9f83b7eedb753))
* error due to unnecessary console log ([917f9fb](https://github.com/jackbuehner/cristata-api/commit/917f9fb038d4333c45b5f545a35ddab3d50dca6d))
* error in findDocAndPrune when doc is null ([06d4b04](https://github.com/jackbuehner/cristata-api/commit/06d4b04f609d219ea9788be0344cef743b45eae1))
* error that @types/mongoose and mongodb types are not compatable ([c661616](https://github.com/jackbuehner/cristata-api/commit/c661616fc928b3ba1b9210e6b64aa9ab549875e7))
* error when more property is undefined ([ba45d9e](https://github.com/jackbuehner/cristata-api/commit/ba45d9efbf0f34290ffa5eb27b558c87b438e635))
* error where pagination only worked with offset ([457390f](https://github.com/jackbuehner/cristata-api/commit/457390f43592775127b0d1087bf165813172eb6f))
* eslint errors ([2f1b9c7](https://github.com/jackbuehner/cristata-api/commit/2f1b9c73d534e67736a9867c3365c81f9b2bab93))
* exclude display_authors from id replacement ([8d7fbdb](https://github.com/jackbuehner/cristata-api/commit/8d7fbdb2b0a0f4dee3d19feca0774693cfaa92a5))
* fall back on current article title when new title is pushed on publish ([94df91a](https://github.com/jackbuehner/cristata-api/commit/94df91aa37d817c299269e3d37f6d12f78a49625))
* fieldpath error when finding doc by id ([bcace6b](https://github.com/jackbuehner/cristata-api/commit/bcace6bafe35e01f462edcb54f64da13e348e2f4))
* **findDoc:** incorrect types ([8becd52](https://github.com/jackbuehner/cristata-api/commit/8becd5289332a705ab30329f9659904c28975440))
* flattenObject argument is undefined ([398631c](https://github.com/jackbuehner/cristata-api/commit/398631c0598eed4241b2dd7c0bb8f1c31d9428cb))
* **flattenObject:** do not flatten valid ObjectId ([6ef18b6](https://github.com/jackbuehner/cristata-api/commit/6ef18b6cf93a6d52596a3583eaeee6ef03e02047))
* **flatten:** remove _doc when hanling mongoose documents ([e920c4b](https://github.com/jackbuehner/cristata-api/commit/e920c4b2981425f320fc6bd2c7352e18a6a4b043))
* **getPasswordStatus:** convert date ms to integer to ensure date is valid ([df0b765](https://github.com/jackbuehner/cristata-api/commit/df0b765417c07bbad24a9bf904f39be2ebb24c32))
* **getUsers:** when userIds is undefined, use null instead of the first user in the database ([f0307c5](https://github.com/jackbuehner/cristata-api/commit/f0307c5813308b9df466d3b5ef2dcd0f34914aa4))
* GHTeams type ([149d695](https://github.com/jackbuehner/cristata-api/commit/149d6959b0cdefa8b47bccb4029b555a024823bb))
* github user id should be number ([1b895c9](https://github.com/jackbuehner/cristata-api/commit/1b895c90b212c61beb84c6f226127f089b1e2603))
* give permission to all articles to managing editors ([a36ab40](https://github.com/jackbuehner/cristata-api/commit/a36ab406a5f9f7b73b3ed46ac60b5ea257c75070))
* **gql:** missing checks for ANY access in `canDo` helper ([5ef777c](https://github.com/jackbuehner/cristata-api/commit/5ef777cd46c6a9c824babc0e61a037f378a6f7d8))
* handle case where doc could no be found ([d8c197b](https://github.com/jackbuehner/cristata-api/commit/d8c197bcf973322404b06da1f02e26ae3b64683d))
* handle case where user doc is undefined ([a472b1c](https://github.com/jackbuehner/cristata-api/commit/a472b1cd5bb1f45d7aa0f94d2d92571f68d888e4))
* handle when pipeline2 is undefined ([3bd9d56](https://github.com/jackbuehner/cristata-api/commit/3bd9d562d5372b4adc994b93bb551f0636b2ab00))
* history subdoc schema ([3cc3251](https://github.com/jackbuehner/cristata-api/commit/3cc3251ae4224c076d675a87ce4083655d503de4))
* incorrect auth user type ([5aa53d2](https://github.com/jackbuehner/cristata-api/commit/5aa53d22cb62921c12601970f7cfeb7628ef8a89))
* incorrect params for create mutations ([4d3536d](https://github.com/jackbuehner/cristata-api/commit/4d3536d770539056b415333a58dbd764ed795f89))
* incorrect schema types and typedefs for users ([4d95f7b](https://github.com/jackbuehner/cristata-api/commit/4d95f7b24afd1abcb96987d27bc0fba106a8f48d))
* incorrect type because passport-local-mongoose converts _id to hex string ([3a3872e](https://github.com/jackbuehner/cristata-api/commit/3a3872e39280d7812e94b0158ac3ccce06d1dcb4))
* incorrect type for `article.people.editor.primary` ([106bde0](https://github.com/jackbuehner/cristata-api/commit/106bde06ff90cbb982fdf8e1524440753b1e7e00))
* incorrectly using Int for User id instead of ObjectID ([c6879dd](https://github.com/jackbuehner/cristata-api/commit/c6879ddcab1bd4effbbc3d468480757e0c7bc14e))
* JSON and Date constuctor overwritten ([ee45d02](https://github.com/jackbuehner/cristata-api/commit/ee45d02ca01f3ecfb9ad0f3d7e88938bf2d78a63))
* missing Date scalar serialization and parsing ([1a79115](https://github.com/jackbuehner/cristata-api/commit/1a79115ae6f22cac09cd08f582fabfd552f007fb))
* missing photo credit on public articles ([08d010b](https://github.com/jackbuehner/cristata-api/commit/08d010bc2de4fa5285c8c884fa9083b7a79d8430))
* **modifyDoc:** actually check if user has permission to modify doc ([87184cd](https://github.com/jackbuehner/cristata-api/commit/87184cd38abb4ec1efc22f9fba264bef976dc944))
* move apollo to onListen so that it connects to the app when server first starts ([7d9760d](https://github.com/jackbuehner/cristata-api/commit/7d9760d8dc7b4c0c07f694a04e33fea29fdb8cb6))
* overwriting data in subobjects ([83502ed](https://github.com/jackbuehner/cristata-api/commit/83502ed0ab12ac96d9b92050bde286009d0eb4e2))
* passport unable to parse query string ([462a8c8](https://github.com/jackbuehner/cristata-api/commit/462a8c8bb53bcbe39980f0f5b277e0c15c7f5aea))
* **passport:** teams not defined in deserialized user ([e2513a9](https://github.com/jackbuehner/cristata-api/commit/e2513a9f6c8ef3b9f3fdd754bbd5c4ffa7e46125))
* permissions field typo ([1366bf5](https://github.com/jackbuehner/cristata-api/commit/1366bf533292c0290b4eb1a30f3d65b9e2d7e4e1))
* **photos:** allow everyone to view photos ([f4ba998](https://github.com/jackbuehner/cristata-api/commit/f4ba998c42af38ba17bff096607d666a01e2285c))
* **photos:** default to Teams.ANY for all photos ([b3aa1d1](https://github.com/jackbuehner/cristata-api/commit/b3aa1d104005365fadc766ab48ab9b9c818853d9))
* prevent processing of infinitly nested objects ([cfac954](https://github.com/jackbuehner/cristata-api/commit/cfac954e8ff67274d79ed1fd515c0217cd0b75ea))
* **pruneDoc:** error when obj is undefined ([d82b8a1](https://github.com/jackbuehner/cristata-api/commit/d82b8a1b9fb27e75cddfad83841714c61ce79451))
* **pruneDocs:** crash when obj is not a mongoose object with toObject() ([e9d31a4](https://github.com/jackbuehner/cristata-api/commit/e9d31a4f31d6f9c97f4d7f405e0c29bb4d1a0b54))
* **prune:** retain object ids as hex instead of undefined ([f41d225](https://github.com/jackbuehner/cristata-api/commit/f41d225b6b9e5bc99cad403bb18b4f2118a513f7))
* query parser not setting ([0b811eb](https://github.com/jackbuehner/cristata-api/commit/0b811eb64cbc5a3aa95dc8c61a5a537e95db6308))
* remove default for articel_id because empty sting is not valid _id ([0ea0b0f](https://github.com/jackbuehner/cristata-api/commit/0ea0b0fef1612b3aef26f0f1237440084a93315b))
* remove unused import ([43579b2](https://github.com/jackbuehner/cristata-api/commit/43579b2d3714f8898475c3f2eb3d603b9c5fd72e))
* return User instead of ObjectId ([f1ca856](https://github.com/jackbuehner/cristata-api/commit/f1ca856892b44c85e24aac4e12c2b778203517b8))
* set default page number to prevent errors ([be3a4b7](https://github.com/jackbuehner/cristata-api/commit/be3a4b73c57548f48bc4fd00b82ab52ae0b82b95))
* socket code continuing when there is no cookie ([852f947](https://github.com/jackbuehner/cristata-api/commit/852f947653b212fe8cc6dad3e156e77b8298adce))
* subdocs not automatically applying ([63c7829](https://github.com/jackbuehner/cristata-api/commit/63c782946e9371cfea7c06b0b323756dab54e035))
* teams is array of strings - not a single string ([9b244be](https://github.com/jackbuehner/cristata-api/commit/9b244bef76c693e8dd8bfcde24f54c613f3af26f))
* types ([1a9d773](https://github.com/jackbuehner/cristata-api/commit/1a9d773bc8c02bbca23f72aa4956fa4589a4d368))
* typescript error ([1039443](https://github.com/jackbuehner/cristata-api/commit/10394434217309da56e4b8f989570f1e6f8d7428))
* unable to save doc changes ([08da782](https://github.com/jackbuehner/cristata-api/commit/08da782369452228c551547285054eb85077e92b))
* undeifned public article authors ([0ed326f](https://github.com/jackbuehner/cristata-api/commit/0ed326f364b86041fdda8638399b20897e4a2045))
* unpublished articles should be hidden from public endpoints ([cc148ed](https://github.com/jackbuehner/cristata-api/commit/cc148ed378588328aad41a5a77e2e98202cd0030))
* use admin PAT since not all users auth with GitHub ([47e8c41](https://github.com/jackbuehner/cristata-api/commit/47e8c4122cf5499b6d469ccefe0e8b7422b85e32))
* use correct action ([b52504d](https://github.com/jackbuehner/cristata-api/commit/b52504ddeb1f1c0c30554bc8b1b243da13dc77a5))
* use custom mutation for settings instead of default collection helpers ([6953a79](https://github.com/jackbuehner/cristata-api/commit/6953a7971b8f316434e669952c5b874adcc3e17f))
* use Date instead of String in typedefs ([0b16dfb](https://github.com/jackbuehner/cristata-api/commit/0b16dfb46aac7b4f0ce4c9a91b122deb11279a58))
* **users:** active users should be able to list other user profiles ([1d8072b](https://github.com/jackbuehner/cristata-api/commit/1d8072b86f8dfa4ce12744d76ec6cf5a82374603))
* **users:** failure to create account when slug or username already exist ([2a97c8d](https://github.com/jackbuehner/cristata-api/commit/2a97c8d22ff47264d7d8e1ad359f9c88fa81b971))
* **v2:** automatic id to profile link ([e692414](https://github.com/jackbuehner/cristata-api/commit/e692414c7bf6f85506d73586b96efc20f6d40020))
* **v2:** flush articles object replaces properties if they do not change ([9888dd1](https://github.com/jackbuehner/cristata-api/commit/9888dd14b1e33763b5c75c3e0c88c42ebdde5d49))
* **v2:** unable to get featured articles ([f1303f4](https://github.com/jackbuehner/cristata-api/commit/f1303f414487a1aff6a17ed4a285b02dcb830592))
* **v2:** undeefined when published stage and creating slug ([99f8c06](https://github.com/jackbuehner/cristata-api/commit/99f8c067f812802f1717e71551e064eb1d0c8315))
* wrong schema for settings collection ([ea40292](https://github.com/jackbuehner/cristata-api/commit/ea40292fd93ea307cf05d867af1bb6e0d73042bb))
