import dotenv from 'dotenv';
import passport from 'passport';
import passportGitHub from 'passport-github2';
import axios from 'axios';
const GitHubStrategy = passportGitHub.Strategy;
import mongoose from 'mongoose';
import { IUserDoc } from './mongodb/users.model';
import { isArray } from './utils/isArray';

// load environmental variables
dotenv.config();

// passport stuff:
passport.serializeUser((user: Record<string, unknown>, done) => {
  if (user.errors && isArray(user.errors) && user.errors.length > 0)
    done(new Error(`${user.errors[0][0]}: ${user.errors[0][1]}`));
  else if (!user._id) done(new Error('User missing _id'));
  else if (!user.provider) done(new Error('User missing provider'));
  else done(null, { _id: user._id, provider: user.provider, next_step: user.next_step });
});

interface IDeserializedUser {
  provider: string;
  _id: mongoose.Types.ObjectId;
  name: string;
  username: string;
  email: string;
  teams: string[];
  two_factor_authentication: boolean;
  next_step: string;
  methods: string[];
}

function deserializeUser(
  user: { _id: mongoose.Types.ObjectId; provider: string; next_step?: string },
  done: (err: Error | null, user?: false | Express.User) => void
): void {
  if (!user._id) done(new Error('serialized user missing _id'));
  else if (!user.provider) done(new Error('serialized user missing provider'));
  else {
    mongoose.model('User').findById(user._id, null, {}, (error, res) => {
      const doc = res as IUserDoc;
      if (error) {
        console.error(error);
        done(error);
      } else if (doc) {
        const { temporary, expired } = getPasswordStatus(doc.flags);
        if (doc.retired) done(new Error('account is deactivated'));
        if (expired) done(new Error('password is expired'));
        else {
          done(null, {
            provider: user.provider,
            _id: user._id,
            name: doc.name,
            username: doc.username,
            email: doc.email,
            teams: doc.teams,
            two_factor_authentication: false,
            next_step: user.next_step ? user.next_step : temporary ? 'change_password' : undefined,
            methods: doc.methods,
          });
        }
      } else {
        done(new Error('doc is undefined'));
      }
    });
  }
}
passport.deserializeUser(deserializeUser);

/**
 * Get whether the user's password is a tempoary password and whether it is expired.
 * @param flags - flag from db.user
 * @returns
 */
function getPasswordStatus(flags: string[]): { temporary: boolean; expired: boolean } {
  const tempPasswordFlag: string | undefined = flags.find((flag) => {
    if (flag.includes('TEMPORARY_PASSWORD')) return true;
    return false;
  });
  const isPasswordExpired = (() => {
    if (tempPasswordFlag) {
      const [, , ms] = tempPasswordFlag.split('_'); // get the time the password expires
      // if the password expired before now, return true
      if (new Date(ms) <= new Date()) return true;
    }
    return false;
  })();
  return { temporary: !!tempPasswordFlag, expired: isPasswordExpired };
}

interface IGitHubProfile {
  id: string;
  nodeId: string;
  displayName: string;
  username: string;
  profileUrl: string;
  photos: { value: string }[];
  provider: string;
  _raw?: string;
  _json?: {
    login: string;
    id: number;
    node_id: string;
    avatar_url: string;
    gravatar_id: string;
    url: string;
    html_url: string;
    followers_url: string;
    following_url: string;
    gists_url: string;
    starred_url: string;
    subscriptions_url: string;
    organizations_url: string;
    repos_url: string;
    events_url: string;
    received_events_url: string;
    type: string;
    site_admin: boolean;
    name: string;
    company: string | null;
    blog: string;
    location: string | null;
    email: string | null;
    hireable: boolean | null;
    bio: string | null;
    twitter_username: string | null;
    public_repos: number;
    public_gists: number;
    followers: number;
    following: number;
    created_at: string;
    updated_at: string;
    two_factor_authentication: boolean;
  };
}

/**
 * Get's the user's email(s) based on the strategy.
 * Email(s) will always be an array of strings.
 */
async function getUserEmails(strategy: 'github', accessToken: string): Promise<string[]> {
  if (strategy === 'github') {
    return await axios
      .get<{ email: string; [key: string]: unknown }[]>(`https://api.github.com/user/emails`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then((res) => {
        const emails: string[] = [];
        res.data.forEach((item) => {
          emails.push(item.email);
        });
        return emails;
      })
      .catch((error) => {
        console.error(error);
        return [];
      });
  }
}

/**
 * Get's the ids of the user's teams/groups based on the strategy.
 */
async function getUserTeams(strategy: 'github', accessToken: string): Promise<string[]> {
  if (strategy === 'github') {
    return await axios
      .get<{ node_id: string; organization: { id: number } }[]>(`https://api.github.com/user/teams`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then((res) => {
        // store array of all user teams
        const teams = Array.from(res.data);
        // get teams that are part of this org
        const orgTeams = teams.filter((team) => team.organization.id === parseInt(process.env.GITHUB_ORG_ID));
        // get team IDs and update the teams array in the full profile
        const orgTeamsNodeIDs = orgTeams.map((team) => team.node_id);
        return orgTeamsNodeIDs;
      })
      .catch((error) => {
        console.error(error);
        return [];
      });
  }
}

interface NormalUser {
  provider: 'github';
  id: string;
  username: string;
  emails: string[];
  teams: string[];
  two_factor_authentication: boolean;
  accessToken: string;
  errors: [string, string, number][];
  next_step?: string;
  _id?: mongoose.Types.ObjectId; // only required when sending user to be serialized (via `done()` callback)
}

/**
 * Build and return a normal user object based on a GitHub user profile.
 */
async function normalizeGitHubUser(gitHubProfile: IGitHubProfile, accessToken: string): Promise<NormalUser> {
  const errors: [string, string, number][] = [];

  // check if user's list of organizations includes our org id
  const isInOrg = await axios
    .get<{ id: number }[]>(`https://api.github.com/user/orgs`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .then((res) => {
      const orgs = Array.from(res.data);
      const orgData = orgs.find((org) => org.id === parseInt(process.env.GITHUB_ORG_ID));
      if (orgData.id) return true;
      return false;
    })
    .catch((error) => {
      console.error(error);
      return false;
    });

  // if the user is not in our org, push an error
  if (!isInOrg) errors.push(['MEMBER_ERROR', 'User is not a member of the GitHub organization', 403]);

  // return the normzalized user object
  return {
    provider: 'github',
    id: gitHubProfile.id,
    username: gitHubProfile.username,
    emails: await getUserEmails('github', accessToken),
    teams: await getUserTeams('github', accessToken),
    two_factor_authentication: gitHubProfile._json.two_factor_authentication,
    accessToken: accessToken,
    errors: errors,
  };
}

/**
 * Returns whether a GitHub user is a member of this organization.
 */
async function isGitHubUserOrgMember(user: NormalUser, accessToken: string): Promise<boolean> {
  // if the user's list of organizations includes our org id, return true
  return await axios
    .get<{ id: number }[]>(`https://api.github.com/user/orgs`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .then((res) => {
      const orgs = Array.from(res.data);
      const orgData = orgs.filter((org) => org.id === parseInt(process.env.GITHUB_ORG_ID));
      if (orgData.length === 1) return true;
      return false;
    })
    .catch((error) => {
      console.error(error);
      return false;
    });
}

/**
 * Add or update a normal user to the database.
 */
async function userToDatabase(user: NormalUser): Promise<mongoose.Types.ObjectId> {
  try {
    // if the user has any errors, do not add to the database
    if (user.errors.length > 0) return;

    // check if the user is already in the database
    const User = mongoose.model<IUserDoc>('User'); // define model
    const foundUser = user.provider === 'github' ? await User.findOne({ github_id: parseInt(user.id) }) : null;
    const userAlreadyExists = !!foundUser;

    if (userAlreadyExists) {
      foundUser.teams = user.teams;
      foundUser.timestamps = { ...foundUser.timestamps, last_login_at: new Date().toISOString() };
      foundUser.email =
        user.emails.find((email) => email.includes('@thepaladin.news')) ||
        user.emails.find((email) => email.includes('@furman.edu'));
      foundUser.methods =
        user.provider === 'github'
          ? Array.from(new Set([...(foundUser.methods || []), 'github']))
          : foundUser.methods;
      const doc = await foundUser.save();
      return doc._id;
    } else {
      // create a new user based on the github profile
      const newUser = new User({
        name: user.username,
        github_id: parseInt(user.id),
        teams: user.teams,
        timestamps: { last_login_at: new Date().toISOString() },
        email:
          user.emails.find((email) => email.includes('@thepaladin.news')) ||
          user.emails.find((email) => email.includes('@furman.edu')),
        methods: user.provider === 'github' ? ['github'] : [],
      });
      const doc = await newUser.save();
      return doc._id;
    }
  } catch (error) {
    console.error(error);
  }
}

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CLIENT_CALLBACK_URL,
    },
    async (
      accessToken: string,
      refreshToken: string,
      gitHubProfile: IGitHubProfile,
      done: (err?: Error | null, user?: NormalUser) => void
    ) => {
      try {
        const user = await normalizeGitHubUser(gitHubProfile, accessToken);
        const isOrgMember = await isGitHubUserOrgMember(user, accessToken);
        if (!isOrgMember) return done(null, { ...user, next_step: 'join_gh_org' });
        const _id = await userToDatabase(user);
        return done(null, { ...user, _id });
      } catch (error) {
        console.error(error);
      }
    }
  )
);

passport.use(mongoose.model('User').createStrategy());

export { getPasswordStatus };
export type { IDeserializedUser };
