// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import SaveEventModal from './SaveEventModal.vue'

it('counts down a rate limit and prevents submission until the deadline', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  const wrapper = mount(SaveEventModal, { props: { show: true, eventName: 'Trip', busy: false, locked: false, error: 'Rate limited', savedId: null, emailStatus: null, retryAt: Date.now() + 61000, attempts: 0 }, global: { stubs: { Teleport: true } } })
  try {
    await wrapper.get('input[name=email]').setValue('a@example.com')
    const button = () => wrapper.get('button[type=submit]')
    expect(button().text()).toBe('Retry in 1:01')
    expect(button().attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(Date.now()).toBe(new Date('2026-01-01T00:00:01Z').getTime())
    await wrapper.vm.$nextTick()
    expect(button().text()).toBe('Retry in 1:00')
    await vi.advanceTimersByTimeAsync(60000)
    await wrapper.vm.$nextTick()
    expect(button().text()).toBe('Save & email link')
    expect(button().attributes('disabled')).toBeUndefined()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toEqual([['a@example.com', 'Trip']])
  } finally {
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
  }
})

it('prefills the required title, requires email, and describes the privacy boundary', async () => {
  const wrapper = mount(SaveEventModal, { props: { show: true, eventName: 'Weekend in Austin', busy: false, locked: false, error: '', savedId: null, emailStatus: null, retryAt: 0, attempts: 0 }, global: { stubs: { Teleport: true } } })
  expect(wrapper.get('input[name=title]').element).toHaveProperty('value', 'Weekend in Austin')
  expect(wrapper.get('input[name=email]').attributes()).toMatchObject({ required: '', type: 'email' })
  expect(wrapper.text()).toContain('No newsletters, no account, nothing to verify.')
  await wrapper.get('input[name=email]').setValue('a@example.com')
  await wrapper.get('form').trigger('submit')
  expect(wrapper.emitted('save')![0]).toEqual(['a@example.com', 'Weekend in Austin'])
  await wrapper.setProps({ savedId: 'saved', emailStatus: 'pending' })
  expect(wrapper.text()).not.toContain('We sent the link')
  expect(wrapper.text()).not.toContain('Try email again')
  wrapper.unmount()
  vi.restoreAllMocks()
})
