/**
 * Dynamic Form: renders form fields from card.formSchema with conditional field
 * support. Evaluates `conditionalFields` based on control field changes and
 * expands/hides the relevant sub-form groups.
 *
 * field.required only applies to basic fields + currently active conditional
 * groups.
 */
import * as React from "react";
import { activeConditionalGroups } from "../conditions.js";

export function DynamicForm({ card, formData, setFormData, t }) {
  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // Determine which conditional groups are active (shared host/client logic)
  const activeGroups = React.useMemo(
    () => activeConditionalGroups(card, formData),
    [card, formData]
  );

  const renderField = (field) => {
    const value = formData[field.key] ?? "";
    const fieldId = `dsh-wb-field-${field.key}`;

    switch (field.type) {
      case "text":
      case "date":
        return (
          <input
            id={fieldId}
            type={field.type === "date" ? "date" : "text"}
            className="dsh-wb-input"
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            placeholder={field.placeholder ?? ""}
          />
        );
      case "textarea":
        return (
          <textarea
            id={fieldId}
            className="dsh-wb-textarea"
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            placeholder={field.placeholder ?? ""}
            rows={3}
          />
        );
      case "select":
        return (
          <select
            id={fieldId}
            className="dsh-wb-select"
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
          >
            <option value="">{field.placeholder ?? "请选择…"}</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      case "file":
        return (
          <div className="dsh-wb-file-input">
            <input
              id={fieldId}
              type="text"
              className="dsh-wb-input"
              value={value}
              onChange={(e) => handleChange(field.key, e.target.value)}
              placeholder="输入文件路径…"
            />
            <span className="dsh-wb-file-hint">(服务端路径)</span>
          </div>
        );
      default:
        return (
          <input
            id={fieldId}
            type="text"
            className="dsh-wb-input"
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
          />
        );
    }
  };

  return (
    <div className="dsh-wb-dynamic-form">
      {/* Basic fields */}
      {card.formSchema.map((field) => (
        <div key={field.key} className="dsh-wb-form-group">
          <label className="dsh-wb-form-label" htmlFor={`dsh-wb-field-${field.key}`}>
            {field.required && <span className="dsh-wb-required">{t("requiredMark")}</span>}
            {field.label}
          </label>
          {renderField(field)}
          {field.description && (
            <p className="dsh-wb-form-desc">{field.description}</p>
          )}
        </div>
      ))}

      {/* Active conditional fields (with transition effect) */}
      {activeGroups.map((group, gi) => {
        const groupKey = `cond-${gi}`;
        return (
          <div key={groupKey} className="dsh-wb-conditional-group">
            {group.fields.map((field) => (
              <div key={field.key} className="dsh-wb-form-group dsh-wb-conditional-field">
                <label className="dsh-wb-form-label" htmlFor={`dsh-wb-field-${field.key}`}>
                  {field.required && <span className="dsh-wb-required">{t("requiredMark")}</span>}
                  {field.label}
                </label>
                {renderField(field)}
                {field.description && (
                  <p className="dsh-wb-form-desc">{field.description}</p>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}