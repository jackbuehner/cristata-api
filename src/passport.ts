import dotenv from 'dotenv';
import passport from 'passport';
import passportGitHub from 'passport-github2';
import axios from 'axios';
const GitHubStrategy = passportGitHub.Strategy;
import mongoose from 'mongoose';
import { IUserDoc } from './mongodb/users.model';
import { slugify } from './utils/slugify';

// load environmental variables
dotenv.config();

// passport stuff:
passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((user, done) => {
  done(null, user);
});

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

interface IProfile extends IGitHubProfile {
  member_status: boolean;
  teams: string[];
  accessToken: string;
  two_factor_authentication: boolean;
  emails: string[];
  _id?: string;
}

/**
 * Builds on the existing GitHub profile to add:
 * - user member status (for this org)
 * - IDs of user's org teams
 *
 * @returns full profile as a promise
 */
async function buildFullProfile(gitHubProfile: IGitHubProfile, accessToken: string): Promise<IProfile> {
  // create the full profile
  // eslint-disable-next-line prefer-const
  let profile: IProfile = {
    ...gitHubProfile,
    member_status: false,
    teams: [],
    accessToken: accessToken,
    two_factor_authentication: gitHubProfile._json.two_factor_authentication,
    emails: [],
  };

  // set `_raw` and `_json` to undefined to reduce cookie size
  profile._raw = undefined;
  profile._json = undefined;

  // if the user's list of organizations includes our org id,
  // set member_status to true
  await axios
    .get<{ id: number }[]>(`https://api.github.com/user/orgs`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .then((res) => {
      const orgs = Array.from(res.data);
      const orgData = orgs.filter((org) => org.id === parseInt(process.env.GITHUB_ORG_ID));
      if (orgData.length === 1) profile.member_status = true;
    })
    .catch((err) => console.error(err));

  // include the user's emails
  await axios
    .get<{ email: string; [key: string]: unknown }[]>(`https://api.github.com/user/emails`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .then((res) => {
      const emails: string[] = [];
      res.data.forEach((item) => {
        emails.push(item.email);
      });
      profile.emails = emails;
    })
    .catch((err) => console.error(err));

  // update the array of the user's teams that are part of our org
  await axios
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
      profile.teams = orgTeamsNodeIDs;
    })
    .catch((err) => console.error(err));

  // return the new profile
  return profile;
}

/**
 * If the profile has `member_status: true`, add it to the users database.
 *
 * If it is already in the database, update it.
 */
async function profileToDatabase(profile: IProfile) {
  if (profile.member_status) {
    try {
      // check if user is already in the database
      const User = mongoose.model<IUserDoc>('User'); // define model
      const foundUser = await User.findOne({ github_id: parseInt(profile.id) });
      const userAlreadyExists = !!foundUser;

      if (userAlreadyExists) {
        User.updateOne(
          { github_id: parseInt(profile.id) },
          {
            $set: {
              name: profile.displayName || profile.username,
              teams: profile.teams,
              timestamps: { ...foundUser.timestamps, last_login_at: new Date().toISOString() },
              slug: slugify(profile.displayName || profile.username),
            },
          }
        );
      } else {
        // create a new user based on the github profile
        const user = new User({
          name: profile.displayName || profile.username,
          github_id: parseInt(profile.id),
          teams: profile.teams,
          timestamps: { last_login_at: new Date().toISOString() },
          slug: slugify(profile.displayName || profile.username),
        });
        await user.save();
      }
    } catch (error) {
      console.error(error);
    }
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
      done: (err?: Error | null, profile?: IProfile) => void
    ) => {
      try {
        const profile = await buildFullProfile(gitHubProfile, accessToken);
        if (!profile.member_status) return done(new Error('NOT_ORG_MEMBER'));
        await profileToDatabase(profile);
        return done(null, {
          ...profile,
          _id: (await mongoose.model<IUserDoc>('User').findOne({ github_id: parseInt(profile.id) }))?._id,
        });
      } catch (error) {
        console.error(error);
      }
    }
  )
);

export { IProfile };
