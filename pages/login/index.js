const api = require('../../utils/api.js')
const wechatAuth = require('../../utils/wechat-auth.js')

const USER_PROFILE_DESC = '用于完善旅邮旅游会员资料'

function normalizeUser(user) {
  const nextUser = user || {}
  const rawAvatarUrl = nextUser.avatarUrl || nextUser.avatarURL || ''
  const avatarUrl = api.resolveMediaUrl ? api.resolveMediaUrl(rawAvatarUrl) : rawAvatarUrl
  return {
    ...nextUser,
    avatarUrl
  }
}

function finishLogin(result) {
  wx.setStorageSync('token', result.token)
  wx.setStorageSync('user', normalizeUser(result.user))
  const pages = getCurrentPages()
  if (pages.length > 1) {
    wx.navigateBack()
  } else {
    wx.reLaunch({ url: '/pages/home/index' })
  }
}

Page({
  data: {
    mode: 'login',
    username: '',
    password: '',
    nickname: '',
    loading: false
  },

  switchLogin() {
    this.setData({ mode: 'login' })
  },

  switchRegister() {
    this.setData({ mode: 'register' })
  },

  onUsernameInput(event) {
    this.setData({ username: event.detail.value })
  },

  onPasswordInput(event) {
    this.setData({ password: event.detail.value })
  },

  onNicknameInput(event) {
    this.setData({ nickname: event.detail.value })
  },

  async submit() {
    const { mode, username, password, nickname } = this.data
    if (!username.trim() || password.length < 6) {
      wx.showToast({ title: '请输入账号和至少 6 位密码', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    try {
      const result = mode === 'login'
        ? await api.login(username.trim(), password)
        : await api.register(username.trim(), password, nickname.trim())
      finishLogin(result)
    } catch (error) {
      wx.showToast({ title: error.error || '操作失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  wechatLogin() {
    if (this.data.loading) {
      return Promise.resolve()
    }

    this.setData({ loading: true })
    return wechatAuth.loginWithWechat(USER_PROFILE_DESC)
      .then((result) => {
        finishLogin(result)
      })
      .catch((error) => {
        wx.showToast({ title: error.error || '微信登录失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ loading: false })
      })
  }
})
