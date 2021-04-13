import dotenv from 'dotenv';
import passport from 'passport';
import passportGitHub from 'passport-github2';
import axios from 'axios';
const GitHubStrategy = passportGitHub.Strategy;

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
  _raw: string;
  _json: {
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
  };
}

interface IProfile extends IGitHubProfile {
  member_status: boolean;
  teams: number[];
  accessToken: string;
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
  };

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

  // update the array of the user's teams that are part of our org
  await axios
    .get<{ id: number; organization: { id: number } }[]>(`https://api.github.com/user/teams`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .then((res) => {
      // store array of all user teams
      const teams = Array.from(res.data);
      // get teams that are part of this org
      const orgTeams = teams.filter((team) => team.organization.id === parseInt(process.env.GITHUB_ORG_ID));
      // get team IDs and update the teams array in the full profile
      const orgTeamsIDs = orgTeams.map((team) => team.id);
      profile.teams = orgTeamsIDs;
    })
    .catch((err) => console.error(err));

  // return the new profile
  return profile;
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
      done: (err?: Error | null, profile?: IGitHubProfile) => void
    ) => {
      const profile = await buildFullProfile(gitHubProfile, accessToken);
      return done(null, profile);
    }
  )
);

export { IProfile };
