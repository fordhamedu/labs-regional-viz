import { test } from 'qunit';
import moduleForAcceptance from 'labs-regional-viz/tests/helpers/module-for-acceptance';

moduleForAcceptance('Acceptance | user clicks next next next previous');

test('visiting /user-clicks-next-next-next-previous', function(assert) {
  visit('/');
  click('.pagination-next a');
  click('.pagination-next a');
  click('.pagination-next a');
  click('.pagination-next a');
  click('.pagination-next a');
  click('.pagination-next a');
  click('.pagination-next a');
  click('.pagination-next a');
  click('.pagination-previous a');
  click('.pagination-previous a');
  click('.pagination-previous a');
  click('.pagination-previous a');
  click('.pagination-previous a');
  click('.pagination-previous a');
  click('.pagination-previous a');
  click('.pagination-previous a');

  andThen(function() {
    assert.equal(currentURL(), '/welcome/intro');
  });
});
