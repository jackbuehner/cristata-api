import { gql } from '../helpers/gql';

const analytics = gql`
  type Query {
    """
    Get an authenticated URL to the fathom analytics dashboard.
    Only administrators can use this query.
    """
    fathomDashboard(): String
  }
`;

export { analytics };
