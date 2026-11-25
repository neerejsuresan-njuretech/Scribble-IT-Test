export interface SponsorConfig {
  githubSponsorsUrl?: string;
  buyMeACoffeeUrl?: string;
  githubRepoUrl: string;
  documentationUrl: string;
  issueTrackerUrl: string;
  licenseName: string;
  licenseUrl: string;
}

export const OPEN_SOURCE_CONFIG: SponsorConfig = {
  githubRepoUrl: 'https://github.com/neerejsuresan-njuretech/Scribble-IT-Test',
  documentationUrl: 'https://github.com/neerejsuresan-njuretech/Scribble-IT-Test#readme',
  issueTrackerUrl: 'https://github.com/neerejsuresan-njuretech/Scribble-IT-Test/issues',
  githubSponsorsUrl: 'https://github.com/neerejsuresan-njuretech/Scribble-IT-Test',
  buyMeACoffeeUrl: 'https://rzp.io/rzp/Njuretech',
  licenseName: 'GNU AGPL-3.0 + Section 7 App Store Exception',
  licenseUrl: 'https://www.gnu.org/licenses/agpl-3.0.en.html',
};
