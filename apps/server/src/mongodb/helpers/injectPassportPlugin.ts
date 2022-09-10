import mongoose from 'mongoose';
import passportLocalMongoose from 'passport-local-mongoose';

function injectPassportPlugin(Schema: mongoose.Schema): void {
  Schema.plugin(passportLocalMongoose, {
    saltlen: 36,
    iterations: 26000,
    keylen: 512,
    digestAlgorithm: 'sha256',
    interval: 100, // 0.1 seconds
    maxInterval: 30000, // 5 minutes
    usernameField: 'username',
    passwordField: 'password',
    usernameUnique: true,
    saltField: 'p_salt',
    hashField: 'p_hash',
    attemptsField: 'p_attempts',
    lastLoginField: 'p_last_login',
    selectFields: ['_id'], // fields to be provided to the serializer function
    usernameCaseInsensitive: false,
    usernameLowerCase: true,
    populateFields: undefined,
    encoding: 'hex',
    limitAttempts: false,
    usernameQueryFields: ['slug'],
  });
}

export { injectPassportPlugin };
