const api = require('../../utils/api.js')

const USER_PROFILE_DESC = '用于完善旅邦旅游会员资料'

function finishLogin(result) {
  console.log('login response', result)
  wx.setStorageSync('token', result.token)
  wx.setStorageSync('user', result.user)
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
    if (this.data.loading) return
    this.setData({ loading: true })
    this.getWechatUserProfile()
      .then((profile) => this.getWechatLoginCode().then((code) => ({ code, profile })))
      .then(async ({ code, profile }) => {
        const result = await api.wechatLogin(code, profile)
        console.log('wechat login response', result)
        finishLogin(result)
      })
      .catch((error) => {
        wx.showToast({ title: error.error || '微信登录失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ loading: false })
      })
  },

  getWechatUserProfile() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: USER_PROFILE_DESC,
        success: (res) => {
          const userInfo = res.userInfo || {}
          resolve({
            nickName: userInfo.nickName || '',
            avatarUrl: userInfo.avatarUrl || '',
            gender: userInfo.gender || 0,
            country: userInfo.country || '',
            province: userInfo.province || '',
            city: userInfo.city || '',
            language: userInfo.language || ''
          })
        },
        fail: () => reject({ error: '需要授权头像昵称后才能登录' })
      })
    })
  },

  getWechatLoginCode() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (loginResult) => {
          if (!loginResult.code) {
            reject({ error: '微信登录失败' })
            return
          }
          resolve(loginResult.code)
        },
        fail: () => reject({ error: '微信登录失败' })
      })
    })
  }
})
