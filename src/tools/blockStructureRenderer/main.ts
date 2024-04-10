/**
 * @dependencies vue, @wikimedia/codex
 * @public
 */
import * as vue from 'vue'
import App from './App.vue'
import getParams from '@/utils/getParams.ts'

const createApp =
  process.env.NODE_ENV === 'development' ? vue.createApp : vue.createMwApp || vue.createApp

function makeBlockStructureRenderer() {
  const targetElAll = document.querySelectorAll('.mcw-calc[data-type="blockStructureRenderer"]')!

  targetElAll.forEach((targetEl) => {
    if (targetEl.querySelector('.do-not-remount-this')) return
    const params = getParams(
      targetEl,
      [
        'blocks',
        'structure',
        'block-states',
        'models',
        'texture-atlas',
        'render-types',
        'occlusion-shapes',
        'special-blocks-data',
        'liquid-computation-data',
        'camera-pos-data',
        'marks',
      ],
      {
        blocks: 'A=air',
        structure: '-',
        'block-states': 'air={}',
        models: '',
        'texture-atlas': '',
        'render-types': '',
        'occlusion-shapes': '',
        'special-blocks-data': '',
        'liquid-computation-data': '',
        'camera-pos-data': '',
        marks: '',
      },
    )

    createApp(App, {
      blocks: params.get('blocks')?.split(';'),
      structure: params.get('structure'),
      blockStates: params.get('block-states')?.split(';'),
      models: params.get('models')?.split(';'),
      textureAtlas: params.get('texture-atlas')?.split(';'),
      renderTypes: params.get('render-types')?.split(';'),
      occlusionShapes: params.get('occlusion-shapes')?.split(';'),
      specialBlocksData: params.get('special-blocks-data')?.split(';'),
      liquidComputationData: params.get('liquid-computation-data')?.split(';'),
      cameraPosData: params.get('camera-pos-data')?.split(';'),
      marks: params.get('marks')?.split(';'),
    }).mount(targetEl)
  })
}

if (process.env.NODE_ENV === 'development' || localStorage.getItem('mcwCalcLocal') === 'true') {
  makeBlockStructureRenderer()
} else {
  mw.hook('wikipage.content').add(makeBlockStructureRenderer)
}