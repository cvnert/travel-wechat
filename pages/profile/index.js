const api = require('../../utils/api.js')
const wechatAuth = require('../../utils/wechat-auth.js')

const USER_PROFILE_DESC = '用于完善旅行会员资料'
const ICON_BASE = '../../assets'

function withIcon(file) {
  return `${ICON_BASE}/${file}`
}

function buildMemberShortcuts() {
  return [
    { key: 'pay', title: '待支付', desc: '去处理', icon: withIcon('order-pay.svg') },
    { key: 'travel', title: '待出行', desc: '看凭证', icon: withIcon('order-travel.svg') },
    { key: 'done', title: '已出行', desc: '看记录', icon: withIcon('order-done.svg') }
  ]
}

function buildOrderItems() {
  return [
    { key: 'pay', label: '待支付', icon: withIcon('order-pay.svg') },
    { key: 'travel', label: '待出行', icon: withIcon('order-travel.svg') },
    { key: 'done', label: '已出行', icon: withIcon('order-done.svg') },
    { key: 'all', label: '全部订单', icon: withIcon('order-all.svg') },
    { key: 'cart', label: '购物车', icon: withIcon('order-cart.svg') }
  ]
}

function buildMenuItems() {
  return [
    { key: 'pay', status: 'pending_payment', title: '待支付订单', icon: withIcon('order-pay.svg') },
    { key: 'travel', status: 'pending_travel', title: '待出行订单', icon: withIcon('order-travel.svg') },
    { key: 'done', status: 'completed', title: '已出行订单', icon: withIcon('order-done.svg') }
  ]
}

function normalizeUser(user) {
  const nextUser = user || {}
  const rawAvatarUrl = nextUser.avatarUrl || nextUser.avatarURL || ''
  const avatarUrl = api.resolveMediaUrl ? api.resolveMediaUrl(rawAvatarUrl) : rawAvatarUrl
  return {
    ...nextUser,
    avatarUrl
  }
}

function buildProfileViewState(token, user) {
  const normalizedUser = normalizeUser(user)
  const isLoggedIn = Boolean(token)
  const nickname = normalizedUser.nickname || normalizedUser.username || '微信用户'
  const avatarUrl = normalizedUser.avatarUrl || ''

  return {
    isLoggedIn,
    nickname,
    avatarUrl,
    avatarText: nickname.slice(0, 1) || '旅',
    memberBadgeText: isLoggedIn ? '旅邮会员' : '微信登录',
    memberNameText: isLoggedIn ? nickname : '点击微信登录',
    memberDescText: isLoggedIn
      ? '订单、凭证、出行状态都在这里统一查看'
      : '登录后同步头像、订单和购物车',
    showLoginButton: !isLoggedIn,
    showLogoutButton: isLoggedIn,
    memberShortcuts: buildMemberShortcuts()
  }
}

Page({
  data: {
    isLoggedIn: false,
    nickname: '',
    avatarUrl: '',
    avatarText: '旅',
    memberBadgeText: '微信登录',
    memberNameText: '点击微信登录',
    memberDescText: '登录后同步头像、订单和购物车',
    showLoginButton: true,
    showLogoutButton: false,
    loginLoading: false,
    profileLoading: false,
    memberShortcuts: buildMemberShortcuts(),
    orderItems: buildOrderItems(),
    menuItems: buildMenuItems(),
    cartIcon: withIcon('order-cart.svg')
  },

  onShow() {
    this.refreshUser()
  },

  refreshUser() {
    const token = wx.getStorageSync('token')
    const user = wx.getStorageSync('user') || {}
    this.setData(buildProfileViewState(token, user))
  },

  handleLoginTap() {
    if (!this.data.isLoggedIn) {
      return this.wechatLogin()
    }
    return Promise.resolve()
  },

  wechatLogin() {
    if (this.data.loginLoading) {
      return Promise.resolve()
    }

    this.setData({ loginLoading: true })
    return wechatAuth.loginWithWechat(USER_PROFILE_DESC)
      .then((result) => {
        const user = normalizeUser(result.user)
        wx.setStorageSync('token', result.token)
        wx.setStorageSync('user', user)
        this.refreshUser()
        wx.showToast({ title: '登录成功', icon: 'success' })
      })
      .catch((error) => {
        wx.showToast({ title: error.error || '微信登录失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ loginLoading: false })
      })
  },

  onChooseAvatar(event) {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return Promise.resolve()
    }

    const avatarUrl = event.detail && event.detail.avatarUrl
    if (!avatarUrl) {
      return Promise.resolve()
    }

    return this.uploadAvatar(avatarUrl)
  },

  uploadAvatar(filePath) {
    if (this.data.profileLoading) {
      return Promise.resolve()
    }

    const previousAvatarUrl = this.data.avatarUrl
    this.setData({
      profileLoading: true,
      avatarUrl: filePath || previousAvatarUrl
    })

    return api.uploadAvatar(filePath)
      .then((result) => {
        const user = normalizeUser(result.user)
        wx.setStorageSync('user', user)
        this.refreshUser()
        if (filePath) {
          this.setData({ avatarUrl: filePath })
        }
        wx.showToast({ title: '头像已更新', icon: 'success' })
      })
      .catch((error) => {
        this.setData({ avatarUrl: previousAvatarUrl })
        wx.showToast({ title: error.error || '头像上传失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ profileLoading: false })
      })
  },

  openOrders(event) {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    const status = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.status || ''
      : ''
    wx.navigateTo({
      url: `/pages/orders/index${status ? `?status=${status}` : ''}`
    })
  },

  openCart() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    wx.switchTab({ url: '/pages/cart/index' })
  },

  handleOrderShortcut(event) {
    const { key } = event.currentTarget.dataset
    if (key === 'cart') {
      this.openCart()
      return
    }
    if (key === 'pay') {
      this.openOrders({ currentTarget: { dataset: { status: 'pending_payment' } } })
      return
    }
    if (key === 'travel') {
      this.openOrders({ currentTarget: { dataset: { status: 'pending_travel' } } })
      return
    }
    if (key === 'done') {
      this.openOrders({ currentTarget: { dataset: { status: 'completed' } } })
      return
    }
    this.openOrders({ currentTarget: { dataset: { status: '' } } })
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      confirmText: '退出',
      confirmColor: '#ef4444',
      success: (res) => {
        if (!res.confirm) {
          return
        }
        wx.removeStorageSync('token')
        wx.removeStorageSync('user')
        this.refreshUser()
        wx.showToast({ title: '已退出登录', icon: 'none' })
      }
    })
  },

  showComingSoon() {
    wx.showToast({ title: '功能建设中', icon: 'none' })
  }
})
