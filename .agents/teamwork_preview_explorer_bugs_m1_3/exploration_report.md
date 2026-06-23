# Exploration Report — Property Platform Bug Investigation

This report details the findings and technical recommendations for resolving bugs and UX enhancements across three key areas: Media Upload (R8), Property Unit Setup (R9), and Chat UX (R10).

---

## R8: Drag-and-Drop File Upload Credential Issues

### Observations & Issue
- **File**: `backend/utils/r2.js`
- **Line numbers**: 11-18
- **Error**: `Error: Resolved credential object is not valid`
- **Root Cause**:
  The `S3Client` is instantiated immediately at module load time when `backend/utils/r2.js` is imported. At this stage, if the environment variables `CLOUDFLARE_R2_ACCESS_KEY_ID` and `CLOUDFLARE_R2_SECRET_ACCESS_KEY` are not yet loaded (which happens if `r2.js` is imported before `dotenv.config()` is executed, or during test suite loads where environment variables are mocked/empty), the `credentials` object contains `undefined` values. The AWS SDK v3 constructor validates this object immediately and throws a fatal error, crashing the server process or preventing test execution.

### Recommendation / Adjustment
Change the static initialization of `S3Client` to **lazy initialization** so that the client is instantiated only when `uploadImage` or `deleteImage` is first invoked, ensuring environment variables are fully loaded.

#### Proposed Changes in `backend/utils/r2.js`:
- Replace the static declaration of `r2` on lines 11-18:
  ```javascript
  // Remove lines 11-18
  ```
- Implement a lazy-loading getter function:
  ```javascript
  let r2Client = null;

  function getR2Client() {
    if (!r2Client) {
      const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
      const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
      
      if (!accessKeyId || !secretAccessKey) {
        throw new Error('Cloudflare R2 credentials (CLOUDFLARE_R2_ACCESS_KEY_ID/CLOUDFLARE_R2_SECRET_ACCESS_KEY) are missing in environment variables.');
      }
      
      r2Client = new S3Client({
        region: 'auto',
        endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
        credentials: {
          accessKeyId,
          secretAccessKey
        }
      });
    }
    return r2Client;
  }
  ```
- Update `uploadImage` (line 29) and `deleteImage` (line 50) to use `getR2Client()`:
  - Line 29: Replace `await r2.send(...)` with `await getR2Client().send(...)`
  - Line 50: Replace `await r2.send(...)` with `await getR2Client().send(...)`
- Update the export statement (line 62):
  ```javascript
  module.exports = { 
    uploadImage, 
    deleteImage, 
    get r2() { return getR2Client(); } // Getter for backwards compatibility
  };
  ```

---

## R9: Property Unit Configuration & '+ Add Unit' Functionality

### Observations & Issues
1. **Schema Exclusions**:
   - **File**: `backend/models/Property.js` (`unitSchema`, lines 3-15)
   - **Problem**: The schema defines only `unit_number`, `unit_type`, `bedrooms`, `rent_kes`, `status`, `current_tenant_id`, `lock_status`, and `unit_geolocation`. However, the frontend (`AddPropertyPage.jsx`) and the backend routes (`properties.js`) capture/send additional fields like `bathrooms`, `floor`, and `size_sqft` / `size_sqm`. Mongoose silently strips out any undefined properties on save, meaning these details are permanently lost.
2. **Property Type Enum Discrepancy**:
   - **File**: `backend/models/Property.js` (`propertySchema`, line 42)
   - **Problem**: The `propertySchema.type` enum is restricted to `['apartment', 'single_family', 'commercial', 'mixed_use']`.
   - **Discrepancy**: 
     - Frontend `PROPERTY_TYPES` (in `AddPropertyPage.jsx`, lines 14-21) includes `'bedsitter'` and `'studio'`.
     - Route `POST /properties/landlord/submit` validator allows `'bedsitter'`, `'single'`, `'studio'`, and `'house'`.
     - Route `POST /properties` validator allows `'bedsitter'` and `'studio'`.
     - Submitting any of these non-enum values passes route validation but crashes on the database level with a Mongoose `ValidationError`.
3. **Role Permission Restriction for Adding Units**:
   - **File**: `backend/routes/properties.js` (line 333)
   - **Problem**: The endpoint `POST /properties/:id/units` is restricted to `['admin', 'super_admin']`. Since agents and landlords are allowed to register properties, they cannot complete the setup because the sequential `addUnit` calls fail with `403 Forbidden` for their roles.
4. **Field Mapping Mismatches**:
   - **Files**: `backend/routes/properties.js` (lines 350-358) and `frontend/src/pages/AddPropertyPage.jsx` (lines 397-407)
   - **Problem**: 
     - The frontend sends `size_sqft`, but the backend route `/properties/:id/units` reads `size_sqm`.
     - The backend route does not map `floor` or `unit_type` (which it calls `type` in the request body) for the new unit, meaning type and floor are lost upon manual unit addition.
5. **Missing Frontend Validation**:
   - **File**: `frontend/src/pages/AddPropertyPage.jsx` (lines 353-369)
   - **Problem**: `validateStep` doesn't verify that unit rent amounts are positive. Since empty values convert to `0`, this causes the backend validator (`body('rent_kes').isInt({ min: 1 })`) to throw validation errors.

### Recommendations / Adjustments

#### 1. Update `backend/models/Property.js`
- Expand `unitSchema` (lines 3-15) to include the missing fields:
  ```javascript
  const unitSchema = new mongoose.Schema({
    unit_number: { type: String, required: true },
    unit_type: { type: String, default: 'bedsitter' }, // Align with 'type'
    bedrooms: Number,
    bathrooms: { type: Number, default: 1 },
    floor: { type: Number, default: 0 },
    size_sqft: Number,
    size_sqm: Number,
    status: { type: String, enum: ['vacant', 'occupied', 'maintenance', 'notice_issued'], default: 'vacant' },
    current_tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
    lock_status: { type: String, enum: ['unlocked', 'pending_viewing', 'viewed_unlocked', 'payment_confirmed', 'locked'], default: 'unlocked' },
    unit_geolocation: {
      type:        { type: String, enum: ['Point'], default: undefined },
      coordinates: { type: [Number], default: undefined }
    }
  }, { _id: true });
  ```
- Expand `propertySchema.type` enum (line 42) to match all allowed types:
  ```javascript
  type: { 
    type: String, 
    enum: ['apartment', 'single_family', 'commercial', 'mixed_use', 'bedsitter', 'studio', 'house', 'single'], 
    required: true 
  }
  ```

#### 2. Update `backend/routes/properties.js`
- Update permission roles on `POST /properties/:id/units` (line 333):
  ```javascript
  requireRole(['admin', 'super_admin', 'agent', 'landlord'])
  ```
- Correct the mapping inside `POST /properties/:id/units` (lines 350-358) to capture all fields:
  ```javascript
  property.units.push({
    unit_number: req.body.unit_number,
    rent_kes: req.body.rent_kes,
    bedrooms: req.body.bedrooms || 1,
    bathrooms: req.body.bathrooms || 1,
    floor: req.body.floor || 0,
    size_sqft: req.body.size_sqft,
    size_sqm: req.body.size_sqm,
    unit_type: req.body.type || req.body.unit_type || 'bedsitter',
    status: 'vacant',
    lock_status: 'unlocked'
  });
  ```

#### 3. Update `frontend/src/pages/AddPropertyPage.jsx`
- Update `validateStep` (line 358) to ensure all units have valid positive rents:
  ```javascript
  if (step === 1) {
    const emptyNum = form.units.find(u => !u.unit_number?.trim());
    if (emptyNum) { toast.error('Every unit must have a unit number'); return false; }
    const invalidRent = form.units.find(u => !u.rent_kes || Number(u.rent_kes) <= 0);
    if (invalidRent) { toast.error('Every unit must have a valid rent amount greater than 0'); return false; }
  }
  ```

---

## R10: Premium ChatAssistant UI/UX Redesign

### Observations & Issues
1. **No Outbound/Close Animation**:
   - The chat assistant renders conditionally via `{isOpen && <div className="... animate-fade-in">}`. When `isOpen` is toggled off, it instantly unmounts from the DOM without playing any closing animation.
2. **Low Text Readability / Contrast Discrepancies**:
   - **Header subtitle**: `text-slate-400` on a `bg-slate-900` header background yields a contrast ratio of ~3.3:1, failing the WCAG AA minimum of 4.5:1.
   - **User message bubble**: `bg-green-600` with white text has a contrast ratio of ~4.45:1, failing WCAG AA guidelines by a narrow margin.
   - **Quick action chips**: `text-gray-600` on `bg-gray-50` provides weak visual weight and contrast under varied screens.
3. **No Dark Mode Support**:
   - The component lacks `dark:` utility variants, resulting in a bright white container that clashes with the rest of the app in dark mode.

### Recommendations / Adjustments

#### 1. Transition and Animation Overhaul (Exit/Enter Animations)
Instead of conditional unmounting, mount the chat container persistently and control its visual state through Tailwind transitions, allowing both entry and exit animations to render smoothly.

Update lines 100-244 in `frontend/src/components/ChatAssistant.jsx`:
```jsx
export default function ChatAssistant({ user, context = {} }) {
  // ... state declarations ...

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {/* Smoothly animated Chat window */}
      <div 
        className={`w-96 h-[520px] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden mb-4 transition-all duration-300 ease-in-out origin-bottom-right transform ${
          isOpen 
            ? 'scale-100 opacity-100 translate-y-0 pointer-events-auto' 
            : 'scale-90 opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
              <Bot size={16} />
            </div>
            <div>
              <p className="font-semibold text-sm leading-none">Mutune AI</p>
              {/* FIXED CONTRAST: text-slate-350 for readable contrast on dark bg */}
              <p className="text-xs text-slate-300 mt-0.5 font-medium">Property Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              id="chat-clear-btn"
              onClick={handleClear}
              title="Clear conversation"
              className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
            >
              <Trash2 size={14} />
            </button>
            <button
              id="chat-close-btn"
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Message Panel with Dark Mode */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin dark:bg-slate-900">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 dark:text-slate-500 px-2">
              <Bot size={32} className="mb-3 opacity-30" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ask me anything about your properties</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">Payments · Maintenance · Notices · Tenants</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {chips.map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(chip)}
                    {/* FIXED CONTRAST & DARK MODE support for Quick Actions */}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-300 dark:hover:border-emerald-800 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors shadow-sm"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot size={12} className="text-white" />
                </div>
              )}
              <div
                {/* FIXED CONTRAST: bg-emerald-700 for user bubble (WCAG compliant) */}
                className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-emerald-700 text-white rounded-tr-none shadow-md shadow-emerald-900/10'
                    : msg.isError
                      ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-tl-none'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-150 dark:border-slate-750'
                }`}
              >
                <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none break-words prose-a:text-emerald-600 dark:prose-a:text-emerald-400 font-medium">
                  {msg.content}
                </ReactMarkdown>
                {msg.toolIntent && renderToolSuggestions(msg.toolIntent)}
              </div>
              {msg.role === 'user' && (
                <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User size={12} className="text-slate-350" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 items-start">
              <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot size={12} className="text-white" />
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-none px-3 py-2.5">
                <div className="flex gap-1.5 items-center">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar with Dark Mode */}
        <form onSubmit={handleSend} className="p-3 border-t border-slate-100 dark:border-slate-800 flex gap-2 flex-shrink-0 bg-white dark:bg-slate-900">
          <input
            ref={inputRef}
            id="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about payments, maintenance..."
            className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-55 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
            maxLength={2000}
            disabled={loading}
          />
          <button
            id="chat-send-btn"
            type="submit"
            disabled={loading || !input.trim()}
            className="w-9 h-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-900/10"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </form>
      </div>

      {/* Floating trigger with premium rotation transform */}
      <button
        id="chat-assistant-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? "Close AI Assistant" : "Open AI Assistant"}
        className={`w-14 h-14 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center transform active:scale-95 ${
          isOpen ? 'rotate-90 scale-90' : 'hover:scale-105'
        }`}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>
    </div>
  );
}
```
