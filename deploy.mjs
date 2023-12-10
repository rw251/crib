import inquirer from 'inquirer';
import { execSync } from 'child_process';

const branch = execSync('git rev-parse --abbrev-ref HEAD', {
  encoding: 'utf8',
}).trim();

if (branch !== 'dev') {
  console.log('You should deploy when on the dev branch.');
  console.log(`You're currently on the ${branch} branch.`);
  process.exit();
}

const versions = {
  major: 'major',
  minor: 'minor',
  patch: 'patch',
};

const incrementVersion = ({ versionType, message }) =>
  execSync(`npm version ${versionType} -m "Upgrade to %s. ${message}"`);

const git = (command, branch) => () =>
  execSync(`git ${command} ${branch || ''}`);
const checkoutMain = git('checkout', 'main');
const checkoutDev = git('checkout', 'dev');
const pull = git('pull');
const push = git('push', '--follow-tags');
const mergeMainIntoDev = git('merge', 'main');
const mergeDevIntoMain = git('merge', 'dev');

checkoutMain();
pull();

inquirer
  .prompt([
    {
      name: 'versionType',
      type: 'list',
      message:
        'What type of versioning do you want to do (vX.Y.Z - major bumps X, minor bumps Y, patch bumps Z)',
      choices: Object.keys(versions),
      default: versions.patch,
    },
    {
      name: 'message',
      type: 'input',
      message: 'Enter a message for the tag',
      validate: (input) =>
        input.length > 0
          ? true
          : 'Must leave a message - think of your future self!!',
    },
  ])
  .then(incrementVersion)
  .then(mergeDevIntoMain)
  .then(push)
  .then(checkoutDev)
  .then(mergeMainIntoDev)
  .then(push)
  .catch((err) => console.log(err));
