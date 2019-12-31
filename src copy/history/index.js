import React from 'react'
import PropTypes from 'prop-types'
import { Provider } from '../context'
import ContrallerBar from '../contraller_bar'
import VideoMessage, { NoSource } from '../message'
import HistoryTimeLine from './time_line_history'
import ErrorEvent from '../event/errorEvent'
import DragEvent from '../event/dragEvent'
import Api from '../api'
import VideoEvent from '../event'
import PlayEnd from './play_end'
import EventName from '../event/eventName'
import ContrallerEvent from '../event/contrallerEvent'
import { getVideoType, createFlvPlayer, createHlsPlayer, getRandom } from '../util'

class HistoryPlayer extends React.Component {
  constructor(props) {
    super(props)
    this.playIndex = 0
    this.player = null
    this.event = null
    this.flv = null
    this.hls = null
    this.playContainerRef = React.createRef()
    this.playContainer = null
    this.state = {
      playChange: false,
      historyList: []
    }
  }
  static getDerivedStateFromProps(props, state) {
    if (props.historyList !== state.historyList) {
      return { historyList: props.historyList, playChange: true }
    }
    return null
  }
  componentDidMount() {
    this.playContainer = this.playContainerRef.current
    this.player = this.playContainer.querySelector('video')
    this.isInit = true
    this.createPlayer()
  }

  componentDidUpdate() {
    if (this.state.playChange) {
      this.setState({ playChange: false })
      this.playIndex = 0
      this.createPlayer()
    }
  }
  componentWillUnmount() {
    this.event && this.event.destroy()
    this.api && this.api.destroy()
    this.player = null
    this.event = null
    this.api = null
    this.playContainerRef = null
    this.playContainer = null
    this.flv = null
    this.hls = null
  }

  createPlayer() {
    const { defaultTime, historyList } = this.props
    const isInit = this.changePlayIndex(this.playIndex)
    if (!isInit) {
      return
    }
    this.event = new VideoEvent(this.player)
    this.api = new Api(this.player, this.playContainer, this.event, this.flv, this.hls)
    this.props.onInitPlayer && this.props.onInitPlayer(this.getPlayerApiContext())

    if (defaultTime) {
      this.seekTo((defaultTime - historyList.beginDate) / 1000)
    }
  }

  initPlayer = index => {
    const { historyList } = this.props
    if (!historyList || !historyList.fragments[index] || !historyList.fragments[index].file) {
      return null
    }
    if (this.flv) {
      this.flv.unload()
      this.flv.destroy()
    }
    if (this.hls) {
      this.hls.stopLoad()
      this.hls.destroy()
    }
    this.playIndex = index
    const type = getVideoType(historyList.fragments[index].file)
    if (type === 'flv' || this.props.type === 'flv') {
      this.flv = createFlvPlayer(this.player, {
        file: historyList.fragments[index].file
      })
      this.api && this.api.updateChunk({ flv: this.flv })
      return this.forceUpdate()
    }
    if (type === 'm3u8' || this.props.type === 'hls') {
      this.hls = createHlsPlayer(this.player, historyList.fragments[index].file)
      this.api && this.api.updateChunk({ hls: this.hls })
      return this.forceUpdate()
    }
    this.player.src = historyList.fragments[index].file
    return this.forceUpdate()
  }
  /**
   * @历史视频
   * @专用修改历史视频播放的索引
   */
  changePlayIndex = index => {
    const { historyList } = this.props
    if (!historyList || !historyList.fragments[index]) {
      this.event && this.event.emit(EventName.HISTORY_PLAY_END)
      return false
    }
    if (!historyList.fragments[index].file) {
      this.changePlayIndex(index + 1)
    } else {
      this.initPlayer(index)
    }
    this.api && this.api.play()
    this.event && this.event.emit(EventName.CHANGE_PLAY_INDEX, index)
    return true
  }

  /**
   * 覆盖Player中暴漏的api，重写seek相关的方法
   */
  getPlayerApiContext = () => {
    if (this.api && this.event) {
      return Object.assign({}, this.api.getApi(), this.event.getApi(), { seekTo: this.seekTo })
    }
    return {}
  }

  /**
   * 根据时间计算当前对应的播放索引
   */
  computedIndexFormTime = time => {
    const { historyList } = this.props
    return historyList.fragments.findIndex(v => v.end > time)
  }

  /**
   * 重写api下的seekTo方法
   */
  seekTo = currentTime => {
    const { historyList } = this.props
    const playIndex = this.computedIndexFormTime(currentTime)
    const fragment = historyList.fragments[playIndex]
    if (!fragment) {
      return
    }
    const seekTime = currentTime - fragment.begin - 1
    this.api && this.api.pause()
    if (playIndex !== this.playIndex || !this.api) {
      this.changePlayIndex(playIndex)
    }
    this.api.seekTo(seekTime, true)
    this.event.emit(EventName.SEEK, currentTime)
  }

  /**
   * 重写reload方法
   */
  reloadHistory = () => {
    this.changePlayIndex(0)
    this.api.seekTo(0)
    this.event.emit(EventName.RELOAD)
    this.api.play()
  }
  /**
   * 覆盖Player中的context的value，新增一些历史视频专用的方法
   */
  getProvider = () => {
    return {
      video: this.player,
      event: this.event,
      playerProps: this.props,
      api: this.api,
      playContainer: this.playContainer,
      changePlayIndex: this.changePlayIndex,
      playIndex: this.playIndex,
      historyList: this.props.historyList,
      seekTo: this.seekTo,
      isHistory: true,
      reloadHistory: this.reloadHistory
    }
  }
  renderVideoTools = () => {
    const file = this.getCurrentFile()
    if (this.isInit && file && this.api && this.event) {
      return (
        <>
          <VideoMessage />
          <ErrorEvent flvPlayer={this.flv} hlsPlayer={this.hls} key={file} />
          <DragEvent />
          <ContrallerEvent>
            <ContrallerBar />
            <HistoryTimeLine />
          </ContrallerEvent>
          <PlayEnd />
        </>
      )
    }
    return <NoSource />
  }
  getErrorKey() {
    return this.getCurrentFile() || getRandom()
  }

  getCurrentFile() {
    let file
    try {
      file = this.props.historyList.fragments[this.playIndex].file
    } catch (error) {
      console.warn(error)
    }
    return file
  }

  render() {
    const { autoplay, poster, preload, muted = 'muted', loop = false, className = '', playsinline = false } = this.props
    const providerValue = this.getProvider()
    const file = this.getCurrentFile()
    return (
      <div className={`lm-player-container ${className}`} ref={this.playContainerRef}>
        <div className="player-mask-layout">
          <video
            autoPlay={autoplay && !!file}
            preload={preload}
            muted={muted}
            poster={poster}
            controls={false}
            playsInline={playsinline}
            loop={loop}
          />
        </div>
        <Provider value={providerValue}>{this.renderVideoTools()}</Provider>
        {this.props.children}
      </div>
    )
  }
}

HistoryPlayer.propTypes = {
  historyList: PropTypes.object.isRequired, //播放地址 必填
  isLive: PropTypes.bool, //是否实时视频
  errorReloadTimer: PropTypes.number, //视频错误重连次数
  type: PropTypes.oneOf(['flv', 'hls', 'native']), //强制视频流类型
  onInitPlayer: PropTypes.func,
  isDraggable: PropTypes.bool,
  isScale: PropTypes.bool,
  muted: PropTypes.string,
  autoPlay: PropTypes.bool,
  playsInline: PropTypes.bool,
  preload: PropTypes.string,
  poster: PropTypes.string,
  loop: PropTypes.bool,
  defaultTime: PropTypes.number,
  className: PropTypes.string,
  playsinline: PropTypes.bool,
  children: PropTypes.any,
  autoplay: PropTypes.bool
}
HistoryPlayer.defaultProps = {
  isLive: true,
  isDraggable: true,
  isScale: true,
  errorReloadTimer: 5,
  muted: 'muted',
  autoPlay: true,
  playsInline: false,
  preload: 'auto',
  loop: false,
  defaultTime: 0
}

export default HistoryPlayer