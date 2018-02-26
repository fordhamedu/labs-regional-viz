import Route from '@ember/routing/route';
import fetch from 'fetch';

export default Route.extend({
  model() {
    return fetch('/assets/cms/content.json')
      .then(blob => blob.json())
      .then((json) => {
        const mutatedJson = json;
        // console.log(mutatedJson);
        const keys = Object.keys(mutatedJson).filter(key => key !== 'meta');
        keys.forEach((key) => {
          mutatedJson[key] = Object.values(mutatedJson[key]);
        });

        return mutatedJson;
      });
  },
});
