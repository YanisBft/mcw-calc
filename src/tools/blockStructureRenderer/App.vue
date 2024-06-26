<script setup lang="ts">
import { computed, onMounted, onUpdated, ref } from 'vue'
import { useI18n } from '@/utils/i18n.ts'
import locales from '@/tools/blockStructureRenderer/locales.ts'
import * as THREE from 'three'
import WebGL from 'three/addons/capabilities/WebGL.js'
import { CdxCheckbox, CdxTextInput, CdxSelect, CdxButton } from '@wikimedia/codex'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { BlockStateModelManager } from '@/tools/blockStructureRenderer/model.ts'
import {
  bakeBlockMarkers,
  bakeBlockModelRenderLayer,
  bakeFluidRenderLayer,
  bakeInvisibleBlocks,
  BlockStructure,
  NameMapping,
} from '@/tools/blockStructureRenderer/renderer.ts'
import { makeMaterialPicker } from '@/tools/blockStructureRenderer/texture.ts'
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'

const props = defineProps<{
  blocks: string[]
  structure: string
  blockStates: string[]
  models: string[]
  textureAtlas: string[]
  renderTypes: string[]
  occlusionShapes: string[]
  specialBlocksData: string[]
  liquidComputationData: string[]
  marks: string[]

  cameraPosData: string[]
  orthographicDefault: boolean
  animatedTextureDefault: boolean
  showInvisibleBlocksDefault: boolean
  displayMarksDefault: boolean
  backgroundColorDefault: string
  backgroundAlphaDefault: number
}>()
const { t } = useI18n(__TOOL_NAME__, locales)
const renderTarget = ref()
const loaded = ref(false)

const orthographic = ref(props.orthographicDefault)
const animatedTexture = ref(props.animatedTextureDefault)
const invisibleBlocks = ref(props.showInvisibleBlocksDefault)
const displayMarks = ref(props.displayMarksDefault)
const backgroundColor = ref(props.backgroundColorDefault)
const backgroundAlpha = ref(
  isNaN(props.backgroundAlphaDefault) ? 255 : props.backgroundAlphaDefault,
)

const displayModeStr = [
  t('blockStructureRenderer.displayModes.all'),
  t('blockStructureRenderer.displayModes.yRange'),
  t('blockStructureRenderer.displayModes.selectedY'),
]
const displayModes = displayModeStr.map((str) => ({
  value: str,
}))
const displayMode = ref(displayModeStr[0])
const ySelected = ref(0)
const yRangeMin = ref(0)
const yRangeMax = ref(0)

const cameraSettingModeStr = [
  t('blockStructureRenderer.cameraSetting.drag'),
  t('blockStructureRenderer.cameraSetting.manual'),
]
const cameraSettingModes = cameraSettingModeStr.map((str) => ({
  value: str,
}))
const cameraSettingMode = ref(cameraSettingModeStr[0])
const cameraX = ref(0)
const cameraY = ref(0)
const cameraZ = ref(0)
const cameraTargetX = ref(0)
const cameraTargetY = ref(0)
const cameraTargetZ = ref(0)

// Three.js setup
const rendererAvailable = WebGL.isWebGLAvailable()
const renderer = new THREE.WebGLRenderer({
  preserveDrawingBuffer: true,
  alpha: true,
  antialias: false,
}) // Do not enable antialiasing: it makes block edges black
renderer.setPixelRatio(window.devicePixelRatio)

const scene = new THREE.Scene()
renderer.setClearColor(backgroundColor.value, backgroundAlpha.value / 255)

const orthographicCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000)
const perspectiveCamera = new THREE.PerspectiveCamera(75, 2, 0.1, 1000)
const camera = computed(() => (orthographic.value ? orthographicCamera : perspectiveCamera))

const orbitOrthoControls = new OrbitControls(orthographicCamera, renderer.domElement)
orbitOrthoControls.addEventListener('change', () => renderer.render(scene, orthographicCamera))
orbitOrthoControls.update()
const orbitPerspectiveControls = new OrbitControls(perspectiveCamera, renderer.domElement)
orbitPerspectiveControls.addEventListener('change', () => renderer.render(scene, perspectiveCamera))
orbitPerspectiveControls.update()

const controls = computed(() =>
  orthographic.value ? orbitOrthoControls : orbitPerspectiveControls,
)

const lineMaterialList = ref([] as LineMaterial[])

const blockStructure = new BlockStructure(props.structure, props.marks)
const nameMapping = new NameMapping(props.blocks)
const modelManager = new BlockStateModelManager(
  props.blockStates,
  props.models,
  props.occlusionShapes,
  props.liquidComputationData,
  props.specialBlocksData,
  nameMapping,
)
const materialPicker = makeMaterialPicker(
  props.textureAtlas,
  props.renderTypes,
  () => {
    loaded.value = true
    bakeFluidRenderLayer(scene, materialPicker, blockStructure, nameMapping, modelManager)
    bakeBlockModelRenderLayer(scene, materialPicker, blockStructure, nameMapping, modelManager)
    if (displayMarks.value) bakeBlockMarkers(scene, blockStructure)
    if (invisibleBlocks.value)
      lineMaterialList.value = bakeInvisibleBlocks(renderer, scene, nameMapping, blockStructure)
  },
  () => animatedTexture.value,
)

if (rendererAvailable) {
  const [maxX, maxY, maxZ] = [blockStructure.x, blockStructure.y, blockStructure.z]
  yRangeMax.value = maxY - 1

  const cameraPos = parsePosition(props.cameraPosData[0]) ?? [maxX / 2, maxY * 1.5, maxZ * 1.5]
  const cameraTarget = parsePosition(props.cameraPosData[1]) ?? [maxX / 2, maxY / 2, maxZ / 2]

  orthographicCamera.position.set(cameraPos[0], cameraPos[1], cameraPos[2])
  perspectiveCamera.position.set(cameraPos[0], cameraPos[1], cameraPos[2])
  orbitOrthoControls.target.set(cameraTarget[0], cameraTarget[1], cameraTarget[2])
  orbitPerspectiveControls.target.set(cameraTarget[0], cameraTarget[1], cameraTarget[2])
  orbitOrthoControls.update()
  orbitOrthoControls.saveState()
  orbitPerspectiveControls.update()
  orbitPerspectiveControls.saveState()
}

function parsePosition(value?: string) {
  if (value) {
    const pos = value.split(',')
    const x = parseFloat(pos[0].trim())
    const y = parseFloat(pos[1].trim())
    const z = parseFloat(pos[2].trim())
    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) return [x, y, z]
  }
}

function clearScene() {
  scene.children.forEach((child) => {
    child.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.material.dispose()
        obj.geometry.dispose()
      }
    })
  })
  scene.clear()
  lineMaterialList.value = []
}

function reBakeRenderLayers() {
  clearScene()
  bakeFluidRenderLayer(scene, materialPicker, blockStructure, nameMapping, modelManager)
  bakeBlockModelRenderLayer(scene, materialPicker, blockStructure, nameMapping, modelManager)
  if (displayMarks.value) bakeBlockMarkers(scene, blockStructure)
  if (invisibleBlocks.value)
    lineMaterialList.value = bakeInvisibleBlocks(renderer, scene, nameMapping, blockStructure)
}

function onDisplayModeChanged() {
  const mode = displayModeStr.findIndex((str) => str === displayMode.value)
  if (mode === 1) {
    if ((!yRangeMin.value && yRangeMin.value !== 0) || (!yRangeMax.value && yRangeMax.value !== 0))
      return
    if (yRangeMax.value > blockStructure.y - 1) return
    if (yRangeMin.value < 0) return
    if (yRangeMin.value > yRangeMax.value) return
    blockStructure.yRange = [yRangeMin.value, yRangeMax.value + 1]
  } else if (mode === 2) {
    if (!ySelected.value && ySelected.value !== 0) return
    if (ySelected.value < 0) return
    if (ySelected.value > blockStructure.y - 1) return
    blockStructure.yRange = [ySelected.value, ySelected.value + 1]
  } else {
    blockStructure.yRange = undefined
  }
  reBakeRenderLayers()
}

function onCameraSettingModeChanged() {
  const mode = cameraSettingModeStr.findIndex((str) => str === cameraSettingMode.value)
  if (mode === 0) {
    orbitOrthoControls.enabled = true
    orbitPerspectiveControls.enabled = true
  } else {
    orbitOrthoControls.enabled = false
    orbitPerspectiveControls.enabled = false
  }
  const control = orthographic.value ? orbitOrthoControls : orbitPerspectiveControls
  cameraX.value = camera.value.position.x - control.target.x
  cameraY.value = camera.value.position.y - control.target.y
  cameraZ.value = camera.value.position.z - control.target.z
  cameraTargetX.value = control.target.x
  cameraTargetY.value = control.target.y
  cameraTargetZ.value = control.target.z
}

function setCamera() {
  orthographicCamera.position.set(
    cameraX.value + cameraTargetX.value,
    cameraY.value + cameraTargetY.value,
    cameraZ.value + cameraTargetZ.value,
  )
  perspectiveCamera.position.set(
    cameraX.value + cameraTargetX.value,
    cameraY.value + cameraTargetY.value,
    cameraZ.value + cameraTargetZ.value,
  )
  orthographicCamera.lookAt(cameraTargetX.value, cameraTargetY.value, cameraTargetZ.value)
  perspectiveCamera.lookAt(cameraTargetX.value, cameraTargetY.value, cameraTargetZ.value)
  orbitPerspectiveControls.target.set(cameraTargetX.value, cameraTargetY.value, cameraTargetZ.value)
  orbitOrthoControls.target.set(cameraTargetX.value, cameraTargetY.value, cameraTargetZ.value)
  orbitOrthoControls.update()
  orbitPerspectiveControls.update()
}

function resetCamera() {
  orbitOrthoControls.reset()
  orbitPerspectiveControls.reset()

  cameraX.value = camera.value.position.x - orbitOrthoControls.target.x
  cameraY.value = camera.value.position.y - orbitOrthoControls.target.y
  cameraZ.value = camera.value.position.z - orbitOrthoControls.target.z
  cameraTargetX.value = orbitOrthoControls.target.x
  cameraTargetY.value = orbitOrthoControls.target.y
  cameraTargetZ.value = orbitOrthoControls.target.z
}

function changeBackgroundColor() {
  renderer.setClearColor(backgroundColor.value, backgroundAlpha.value / 255)
}

function saveRenderedImage() {
  const downloadLink = document.createElement('a')
  downloadLink.setAttribute('download', 'block_structure.png')
  renderer.domElement.toBlob(function (blob) {
    let url = URL.createObjectURL(blob!)
    downloadLink.setAttribute('href', url)
    downloadLink.click()
  })
}

const hidden = ref(false)

function animate() {
  requestAnimationFrame(animate)

  // Check if the render target is visible
  if (renderTarget.value.offsetParent === null) {
    if (hidden.value) return
    hidden.value = true
    clearScene()
    return
  }
  if (hidden.value) {
    hidden.value = false
    reBakeRenderLayers()
  }

  const bounds = renderTarget.value.getBoundingClientRect()
  if (
    (bounds.top <= 0 && bounds.bottom <= 0) ||
    (bounds.top >= document.documentElement.clientHeight &&
      bounds.bottom >= document.documentElement.clientHeight) ||
    (bounds.left <= 0 && bounds.right <= 0) ||
    (bounds.left >= document.documentElement.clientWidth &&
      bounds.right >= document.documentElement.clientWidth)
  )
    return

  controls.value.update()
  renderer.render(scene, camera.value)
}

function updateDisplay() {
  const width =
    renderTarget.value.getBoundingClientRect().right -
    renderTarget.value.getBoundingClientRect().left
  const height =
    renderTarget.value.getBoundingClientRect().bottom -
    renderTarget.value.getBoundingClientRect().top
  const aspect = width / height
  perspectiveCamera.aspect = aspect
  orthographicCamera.left = -aspect * 2
  orthographicCamera.right = aspect * 2
  orthographicCamera.top = 2
  orthographicCamera.bottom = -2
  renderer.setSize(width, height)
  orthographicCamera.updateProjectionMatrix()
  perspectiveCamera.updateProjectionMatrix()
  orbitOrthoControls.update()
  orbitPerspectiveControls.update()
  lineMaterialList.value.forEach((lineMaterial) => {
    lineMaterial.resolution.set(width, height)
  })
}

onMounted(() => {
  if (rendererAvailable) {
    updateDisplay()
    renderTarget.value.appendChild(renderer.domElement)
    new ResizeObserver(updateDisplay).observe(renderTarget.value)
    animate()
  } else {
    renderTarget.value.appendChild(WebGL.getWebGLErrorMessage())
  }
})

onUpdated(() => {
  if (rendererAvailable) {
    updateDisplay()
  }
})

const labelColorPicker = ref('color-picker-' + Math.random().toString(36).substring(7))
const labelBackgroundAlpha = ref('background-alpha-' + Math.random().toString(36).substring(7))
const labelDisplayMode = ref('display-mode-' + Math.random().toString(36).substring(7))
const labelCameraSetting = ref('camera-setting-' + Math.random().toString(36).substring(7))
</script>

<template>
  <div
    class="do-not-remount-this renderer-component"
    ref="renderTarget"
    :style="{
      height: '50vh',
      width: 'max(60%, 50vh)',
      marginTop: '0.5em',
      marginBottom: '0.5em',
    }"
  />
  <cdx-checkbox v-if="loaded" v-model="orthographic">
    {{ t('blockStructureRenderer.orthographic') }}
  </cdx-checkbox>
  <cdx-checkbox v-if="loaded" v-model="animatedTexture">
    {{ t('blockStructureRenderer.animatedTexture') }}
  </cdx-checkbox>
  <cdx-checkbox
    v-if="
      loaded && (blockStructure.hasInvisibleBlocks(nameMapping) || props.showInvisibleBlocksDefault)
    "
    v-model="invisibleBlocks"
    @change="reBakeRenderLayers"
  >
    {{ t('blockStructureRenderer.renderInvisibleBlocks') }}
  </cdx-checkbox>
  <cdx-checkbox
    v-if="loaded && blockStructure.hasMarks()"
    v-model="displayMarks"
    @change="reBakeRenderLayers"
  >
    {{ t('blockStructureRenderer.renderMarks') }}
  </cdx-checkbox>

  <div
    v-if="loaded"
    :style="{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '.5rem',
      marginBottom: '0.5em',
    }"
  >
    <label :for="labelColorPicker">{{ t('blockStructureRenderer.backgroundColor') }}</label>
    <input
      type="color"
      v-model="backgroundColor"
      :id="labelColorPicker"
      @change="changeBackgroundColor"
    />
    <label :for="labelBackgroundAlpha">{{ t('blockStructureRenderer.backgroundAlpha') }}</label>
    <cdx-text-input
      :id="labelBackgroundAlpha"
      v-model="backgroundAlpha"
      inputType="number"
      :min="0"
      :max="255"
      step="1"
      @input="changeBackgroundColor"
    />
  </div>
  <div
    v-if="loaded"
    :style="{
      display: 'flex',
      flexDirection: 'column',
      flexWrap: 'wrap',
      gap: '.5rem',
      marginBottom: '0.5em',
    }"
  >
    <div>
      <label :for="labelDisplayMode" :style="{ marginRight: '.5rem' }">
        {{ t('blockStructureRenderer.displayMode') }}
      </label>
      <cdx-select
        :id="labelDisplayMode"
        v-model:selected="displayMode"
        :menu-items="displayModes"
        :style="{
          width: 'fit-content',
        }"
        @update:selected="onDisplayModeChanged"
      />
    </div>
    <div
      v-if="displayMode !== displayModeStr[0]"
      :style="{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '.5rem',
      }"
    >
      <span>{{ t('blockStructureRenderer.renderRange') }}</span>
      <cdx-text-input
        v-if="displayMode === displayModeStr[1]"
        v-model="yRangeMin"
        inputType="number"
        min="0"
        :max="Math.max(yRangeMax, 0)"
        step="1"
        @input="onDisplayModeChanged"
      />
      <span v-if="displayMode === displayModeStr[1]"> - </span>
      <cdx-text-input
        v-if="displayMode === displayModeStr[1]"
        v-model="yRangeMax"
        inputType="number"
        :min="Math.min(yRangeMin, blockStructure.y - 1)"
        :max="blockStructure.y - 1"
        step="1"
        @input="onDisplayModeChanged"
      />
      <cdx-text-input
        v-if="displayMode === displayModeStr[2]"
        v-model="ySelected"
        inputType="number"
        min="0"
        :max="blockStructure.y - 1"
        step="1"
        @input="onDisplayModeChanged"
      />
    </div>
  </div>
  <div
    v-if="loaded"
    :style="{
      display: 'flex',
      flexDirection: 'column',
      flexWrap: 'wrap',
      gap: '.5rem',
      marginBottom: '0.5em',
    }"
  >
    <div
      :style="{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '.5rem',
      }"
    >
      <label :for="labelCameraSetting">
        {{ t('blockStructureRenderer.cameraSetting') }}
      </label>
      <cdx-select
        :id="labelCameraSetting"
        v-model:selected="cameraSettingMode"
        :menu-items="cameraSettingModes"
        :style="{
          width: 'fit-content',
        }"
        @update:selected="onCameraSettingModeChanged"
      />
      <cdx-button v-if="cameraSettingMode === cameraSettingModeStr[1]" @click="setCamera">
        {{ t('blockStructureRenderer.cameraSetting.confirm') }}
      </cdx-button>
    </div>
    <div
      v-if="cameraSettingMode === cameraSettingModeStr[1]"
      :style="{
        display: 'flex',
        flexDirection: 'column',
        gap: '.5rem',
      }"
    >
      <div
        :style="{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '.5rem',
        }"
      >
        <span>{{ t('blockStructureRenderer.cameraSetting.position') }} (</span>
        <cdx-text-input v-model="cameraX" inputType="number" step="0.1" />
        <span>, </span>
        <cdx-text-input v-model="cameraY" inputType="number" step="0.1" />
        <span>, </span>
        <cdx-text-input v-model="cameraZ" inputType="number" step="0.1" />
        <span>)</span>
      </div>
      <div
        :style="{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '.5rem',
        }"
      >
        <span>{{ t('blockStructureRenderer.cameraSetting.target') }} (</span>
        <cdx-text-input v-model="cameraTargetX" inputType="number" step="0.1" />
        <span>, </span>
        <cdx-text-input v-model="cameraTargetY" inputType="number" step="0.1" />
        <span>, </span>
        <cdx-text-input v-model="cameraTargetZ" inputType="number" step="0.1" />
        <span>)</span>
      </div>
    </div>
  </div>
  <div
    v-if="loaded"
    :style="{
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: '.5rem',
    }"
  >
    <cdx-button @click="resetCamera">{{ t('blockStructureRenderer.resetCamera') }}</cdx-button>
    <cdx-button @click="saveRenderedImage">{{ t('blockStructureRenderer.saveImage') }}</cdx-button>
  </div>
</template>
