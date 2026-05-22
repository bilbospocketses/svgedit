const template = document.createElement('template')
template.innerHTML = `
  <style>
  input{
    border:unset;
    background-color:var(--input-color);
    min-width:unset;
    width:40px;
    height:23px;
    padding:1px 2px;
    border:2px;
    font: inherit;
    margin: 2px 1px 0px 2px;
    box-sizing:border-box;
    text-align: center;
    border-radius: 3px 0px 0px 3px;
  }
  #tool-wrapper{
    height:20px;
    display:flex;
    align-items:center;
  }
  #icon{
    margin-bottom:1px
  }
  #spinner{
    display:flex;
    flex-direction:column;
  }
  #spinner > div {
    height: 11px;
    width: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 7px;
    border-left:solid 1px transparent;
    border-right:solid 1px transparent;
    background-color:var(--input-color);
  }
  #arrow-up{
    height:9px;
    margin-top: 2px;
    margin-bottom: 1px;
  }
  #arrow-up, #arrow-down {
    user-select: none;
  }
  @keyframes hover-arrows {
    from {
      background: transparent;
      color: var(--icon-bg-color-hover);
    }

    to {
      background: var(--icon-bg-color-hover);
      color: var(--orange-color);
    }
  }
  #arrow-up:hover, #arrow-down:hover {
    animation: hover-arrows 0.2s forwards;
  }
  #down{
    width:18px;
    height:23px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color:var(--input-color);
    border-radius: 0px 3px 3px 0px;
    margin: 2px 5px 0px 1px;
  }
  #down > img {
    margin-top: 2px;
  }
  #options-container {
    position:fixed; /* TODO: see todo #10 — missing semicolon after position:fixed in original, preserved as-is */
    display:flex;
    flex-direction:column;
    background-color:var(--icon-bg-color);
    border:solid 1px white;
    box-shadow:0 0px 10px rgb(0 0 0 / 50%);
  }
  ::slotted(*) {
    margin:2px;
    padding:3px;
    color:white;
  }
  ::slotted(*:hover) {
    background-color: rgb(43, 60, 69);
  }
  </style>
  <div id="tool-wrapper">
    <img id="icon" alt="icon" width="18" height="18"/>
    <input/>
    <div id="spinner">
      <div id="arrow-up">▲</div>
      <div id="arrow-down">▼</div>
    </div>
    <div id="down">
      <img width="16" height="8" src="arrow_down.svg" alt="Zoom dropdown"/>
    </div>
  </div>
  <div id="options-container" style="display:none">
    <slot></slot>
  </div>
`

class SeZoom extends HTMLElement {
  _shadowRoot: ShadowRoot
  slotElement: HTMLSlotElement
  inputElement: HTMLInputElement
  clickArea: HTMLElement
  imgPath: string
  downImageElement: HTMLImageElement
  imageElement: HTMLImageElement
  arrowUp: HTMLElement
  arrowDown: HTMLElement
  optionsContainer: HTMLElement
  changedTimeout: ReturnType<typeof setTimeout> | null
  options: Element[]
  selectedValue: string | null
  incrementHold: boolean
  decrementHold: boolean

  constructor () {
    super()

    this.handleMouseDown = this.handleMouseDown.bind(this)
    this.handleMouseUp = this.handleMouseUp.bind(this)
    this.handleKeyDown = this.handleKeyDown.bind(this)
    this.initPopup = this.initPopup.bind(this)
    this.handleInput = this.handleInput.bind(this)
    this.options = []
    this.selectedValue = null
    this.incrementHold = false
    this.decrementHold = false

    // create the shadowDom and insert the template
    this._shadowRoot = this.attachShadow({ mode: 'open' })
    // locate the component
    this._shadowRoot.append(template.content.cloneNode(true))

    // prepare the slot element
    this.slotElement = this._shadowRoot.querySelector('slot') as HTMLSlotElement
    this.slotElement.addEventListener(
      'slotchange',
      this.handleOptionsChange.bind(this)
    )

    // hookup events for the input box
    this.inputElement = this._shadowRoot.querySelector('input') as HTMLInputElement
    this.inputElement.addEventListener('click', this.handleClick.bind(this))
    this.inputElement.addEventListener('change', this.handleInput.bind(this))
    this.inputElement.addEventListener('keydown', this.handleKeyDown.bind(this))

    this.clickArea = this._shadowRoot.querySelector('#down') as HTMLElement
    this.clickArea.addEventListener('click', this.handleClick.bind(this))

    this.imgPath = svgEditor.configObj.curConfig.imgPath

    this.downImageElement = this.clickArea.querySelector('img') as HTMLImageElement
    this.downImageElement.setAttribute(
      'src',
      (this.imgPath + '/' + this.downImageElement.getAttribute('src'))
    )

    // set src for imageElement
    this.imageElement = this._shadowRoot.querySelector('img') as HTMLImageElement
    this.imageElement.setAttribute(
      'src',
      (this.imgPath + '/' + this.getAttribute('src'))
    )

    // hookup events for arrow buttons
    this.arrowUp = this._shadowRoot.querySelector('#arrow-up') as HTMLElement
    this.arrowUp.addEventListener('click', this.increment.bind(this))
    this.arrowUp.addEventListener('mousedown', (_e) =>
      this.handleMouseDown('up', true)
    )
    this.arrowUp.addEventListener('mouseleave', (_e) => this.handleMouseUp('up'))
    this.arrowUp.addEventListener('mouseup', (_e) => this.handleMouseUp('up'))

    this.arrowDown = this._shadowRoot.querySelector('#arrow-down') as HTMLElement
    this.arrowDown.addEventListener('click', this.decrement.bind(this))
    this.arrowDown.addEventListener('mousedown', (_e) =>
      this.handleMouseDown('down', true)
    )
    this.arrowDown.addEventListener('mouseleave', (_e) =>
      this.handleMouseUp('down')
    )
    this.arrowDown.addEventListener('mouseup', (_e) => this.handleMouseUp('down'))

    this.optionsContainer = this._shadowRoot.querySelector(
      '#options-container'
    ) as HTMLElement

    // add an event listener to close the popup
    document.addEventListener('click', e => this.handleClose(e))
    this.changedTimeout = null
  }

  static get observedAttributes () {
    return ['value']
  }

  /**
   * @function get
   */
  get value (): string {
    return this.getAttribute('value') ?? ''
  }

  /**
   * @function set
   */
  set value (value: string | number) {
    this.setAttribute('value', String(value))
  }

  /**
   * @function attributeChangedCallback
   * @param name
   * @param oldValue
   * @param newValue
   */
  // TODO: see todo #10 — inverted-guard attributeChangedCallback: runs inner block when old===new; preserved as-is
  attributeChangedCallback (name: string, oldValue: string, newValue: string): void {
    if (oldValue === newValue) {
      switch (name) {
        case 'value':
          if (parseInt(this.inputElement.value) !== parseInt(newValue)) {
            this.inputElement.value = newValue
          }
          break
      }

      return
    }

    switch (name) {
      case 'value':
        this.inputElement.value = newValue
        this.dispatchEvent(
          new CustomEvent('change', { detail: { value: newValue } })
        )
        break
    }
  }

  /**
   * @function handleOptionsChange
   */
  handleOptionsChange (): void {
    if (this.slotElement.assignedElements().length > 0) {
      this.options = this.slotElement.assignedElements()
      this.selectedValue = this.options[0]?.textContent ?? null

      this.initPopup()

      this.options.forEach(option => {
        option.addEventListener('click', e => this.handleSelect(e))
      })
    }
  }

  /**
   * @function handleClick
   */
  handleClick () {
    this.optionsContainer.style.display = 'flex'
    this.inputElement.select()
    this.initPopup()
  }

  /**
   * @function handleSelect
   * @param e
   */
  handleSelect (e: Event): void {
    const target = e.target as Element
    this.value = target.getAttribute('value') ?? ''
    this.title = target.getAttribute('text') ?? ''
  }

  /**
   * @function handleShow
   * initialises the popup menu position
   */
  initPopup () {
    const zoomPos = this.getBoundingClientRect()
    const popupPos = this.optionsContainer.getBoundingClientRect()
    const top = zoomPos.top - popupPos.height
    const left = zoomPos.left

    this.optionsContainer.style.position = 'fixed'
    this.optionsContainer.style.top = `${top}px`
    this.optionsContainer.style.left = `${left}px`
  }

  /**
   * @function handleClose
   * @param e
   * Close the popup menu
   */
  handleClose (e: Event): void {
    if (e.target !== this) {
      this.optionsContainer.style.display = 'none'
      this.inputElement.blur()
    }
  }

  /**
   * @function handleInput
   */
  handleInput () {
    if (this.changedTimeout) {
      clearTimeout(this.changedTimeout)
    }

    this.changedTimeout = setTimeout(this.triggerInputChanged.bind(this), 500)
  }

  /**
   * @function triggerInputChanged
   */
  triggerInputChanged () {
    const newValue = this.inputElement.value
    this.value = newValue
  }

  /**
   * @function increment
   */
  increment (): void {
    this.value = parseInt(this.value) + 10
  }

  /**
   * @function decrement
   */
  decrement (): void {
    const current = parseInt(this.value)
    if (current - 10 <= 0) {
      this.value = 10
    } else {
      this.value = current - 10
    }
  }

  /**
   * @function handleMouseDown
   * @param dir
   * @param isFirst
   * Increment/Decrement on mouse held down, if its the first call add a delay before starting
   */
  handleMouseDown (dir: string, isFirst: boolean): void {
    if (dir === 'up') {
      this.incrementHold = true
      if (!isFirst) { this.increment() }

      setTimeout(
        () => {
          if (this.incrementHold) {
            this.handleMouseDown(dir, false)
          }
        },
        isFirst ? 500 : 50
      )
    } else if (dir === 'down') {
      this.decrementHold = true
      if (!isFirst) { this.decrement() }

      setTimeout(
        () => {
          if (this.decrementHold) {
            this.handleMouseDown(dir, false)
          }
        },
        isFirst ? 500 : 50
      )
    }
  }

  /**
   * @function handleMouseUp
   * @param dir
   */
  handleMouseUp (dir: string): void {
    if (dir === 'up') {
      this.incrementHold = false
    } else {
      this.decrementHold = false
    }
  }

  /**
   * @function handleKeyDown
   * @param e
   */
  handleKeyDown (e: KeyboardEvent): void {
    if (e.key === 'ArrowUp') {
      this.increment()
    } else if (e.key === 'ArrowDown') {
      this.decrement()
    }
  }
}

// Register
customElements.define('se-zoom', SeZoom)
