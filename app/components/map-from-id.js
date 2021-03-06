import Component from '@ember/component';
import mapboxgl from 'mapbox-gl';
import { computed } from 'ember-decorators/object';
import { get } from '@ember/object';
import carto from 'ember-jane-maps/utils/carto';
import getPopupSQL from '../utils/get-popup-sql';
import buildPopupContent from '../utils/build-popup-content';

export default Component.extend({
  classNameBindings: ['narrativeVisible:narrative-visible'],
  classNames: 'map-container cell large-auto',
  toggledGeographyLevel: null,
  tooltipPoint: { x: 0, y: 0 },

  // noop for passed context
  toggleNarrative() {},
  mapConfig: {
    layers: [],
  },

  loading: true,

  zoom: 9,
  maxZoom: 14,
  minZoom: 5,
  center: [-73.869324, 40.815888],
  regionBounds: [[-75.234614, 39.480131], [-71.820730, 42.205393]],
  maxBounds: [[-79.2185899687017, 37.091720189853106], [-67.83675403119405, 44.41941348578442]],

  highlightedFeature: null,

  popup: new mapboxgl.Popup({
    closeOnClick: false,
  }),

  @computed('mapConfig', 'toggledGeographyLevel')
  geographyLevel(defaultGeographyLevel = 'county', toggledGeographyLevel = null) {
    if (toggledGeographyLevel) {
      return toggledGeographyLevel;
    }
    return get(defaultGeographyLevel, 'defaultGeographyLevel');
  },

  @computed('mapConfig', 'geographyLevel')
  currentLayerGroup(mapConfig, geographyLevel) {
    const { layerGroups = [] } = mapConfig;
    const foundLayerGroup = layerGroups.find(d => d.id === geographyLevel) || {};

    return foundLayerGroup;
  },

  @computed('currentLayerGroup')
  mapTitle(layerConfig) {
    return layerConfig ? layerConfig.title : '';
  },

  @computed('highlightedFeature')
  highlightedFeatureSource(feature) {
    return {
      type: 'geojson',
      data: feature,
    };
  },

  @computed('highlightedFeature')
  popupData(feature) {
    return feature.properties;
  },

  highlightedFeatureLayer: {
    id: 'highlighted-feature',
    type: 'line',
    source: 'highlighted-feature',
    paint: {
      'line-color': '#555555',
      'line-opacity': 0.8,
      'line-width': {
        stops: [
          [8, 2],
          [11, 4],
        ],
      },
    },
  },

  @computed('mapConfig', 'geographyLevel')
  visibleLayers({ mapboxLayers = [] }, selectedGeographyLevel) {
    return mapboxLayers
      .find(layerGroup => layerGroup.id === selectedGeographyLevel)
      .layers;
  },

  didReceiveAttrs() {
    const previousNarrativeVisible = this.get('previousNarrativeVisible');
    const narrativeVisible = this.get('narrativeVisible');

    if (previousNarrativeVisible === narrativeVisible) {
      this.set('toggledGeographyLevel', null);
    }

    this.set('previousNarrativeVisible', narrativeVisible);
  },

  didUpdateAttrs() {
    const map = this.get('map');
    if (!map) return;
    const sources = this.get('mapConfig.sources');
    const popup = this.get('popup');

    sources.forEach((source) => {
      if (!map.getSource(source.id)) {
        map.addSource(source.id, source);
      }
    });

    popup.remove();

    // This is repeated in handleMapLoad(), maybe move to service
    const regionBounds = this.get('regionBounds');
    map.fitBounds(regionBounds, {
      padding: {
        top: 20,
        bottom: 20,
        left: 10,
        right: 10,
      },
    });
  },

  actions: {
    handleMapLoad(map) {
      const sources = this.get('mapConfig.sources');
      this.set('map', map);

      if (window) {
        window.map = map;
      }

      map.addControl(new mapboxgl.NavigationControl(), 'top-left');
      map.addControl(new mapboxgl.ScaleControl({ unit: 'imperial' }), 'bottom-left');

      sources.forEach((source) => {
        map.addSource(source.id, source);
      });

      map.addSource('highlighted-feature', this.get('highlightedFeatureSource'));

      // This is repeated in didUpdateAttrs(), maybe move to service
      const regionBounds = this.get('regionBounds');
      map.fitBounds(regionBounds, {
        padding: {
          top: 20,
          bottom: 20,
          left: 10,
          right: 10,
        },
      });
    },

    handleMouseMove(e) {
      const layers = this.get('visibleLayers').map(d => d.id);
      const feature = e.target.queryRenderedFeatures(e.point, { layers })[0];
      const map = this.get('map');

      if (feature) {
        // set the highlighted feature
        this.set('highlightedFeature', feature);
        this.set('tooltipPoint', {
          x: e.point.x + 20,
          y: e.point.y + 20,
        });
        map.getSource('highlighted-feature').setData(feature);
      } else {
        this.set('highlightedFeature', null);
      }

      const { popupColumns } = this.get('mapConfig');

      map.getCanvas().style.cursor = (feature && popupColumns) ? 'pointer' : '';
    },

    handleMouseClick(e) {
      const layers = this.get('visibleLayers')
        .filter(d => d.type !== 'circle') // exclude dot density maps
        .map(d => d.id);
      const feature = e.target.queryRenderedFeatures(e.point, { layers })[0];
      const popup = this.get('popup');
      const {
        popupColumns, isPermitMap, isPercent, isRatio, isChangeMeasurement,
      } = this.get('mapConfig');

      // Add the popup with a spinner before loading its data
      popup.setLngLat(e.lngLat)
        .setHTML('<i aria-hidden="true" class="fa fa-spinner fa-spin medium-gray fa-3x fa-fw"></i>')
        .addTo(this.get('map'));

      // Add data to the popup
      if (feature) {
        const SQL = getPopupSQL(e.lngLat, this.get('mapConfig'), this.get('geographyLevel'));
        const geographyLevel = this.get('geographyLevel');

        carto.SQL(SQL)
          .then((data) => {
            popup.setHTML(buildPopupContent(data, geographyLevel, popupColumns, isPermitMap, isPercent, isRatio, isChangeMeasurement));
          });
      } else {
        popup.remove();
      }
    },

    handleGeographyLevelToggle(geog) {
      this.get('popup').remove();
      this.set('toggledGeographyLevel', geog);
    },

    mapLoading(data) {
      // Create array of local source IDs from the config (not e.g. basemap sources)
      const localConfig = this.get('mapConfig');
      const sourceIds = localConfig.sources.mapBy('id');

      // Is this data event's source ID in the array of local source IDs?
      const isLocalSource = sourceIds.find(d => d === data.sourceId) && data.dataType === 'source';

      if (isLocalSource) {
        if (data.isSourceLoaded) {
          this.set('loading', false);
        } else {
          this.set('loading', true);
        }
      }
    },
  },
});
