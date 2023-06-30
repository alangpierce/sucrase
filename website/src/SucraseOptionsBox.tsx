import {css, StyleSheet} from "aphrodite";
import {useState} from "react";
import type {Transform} from "sucrase";

import CheckBox from "./CheckBox";
import {type HydratedOptions, TRANSFORMS} from "./Constants";
import OptionsBox from "./OptionsBox";
import SimpleSelect from "./SimpleSelect";
import TextInput from "./TextInput";

interface SucraseOptionsBoxProps {
  options: HydratedOptions;
  onUpdateOptions: (options: HydratedOptions) => void;
}

function addTransform(transforms: Array<Transform>, transform: Transform): Array<Transform> {
  if (transforms.includes(transform)) {
    return transforms;
  }
  const newTransforms = [...transforms, transform];
  // Keep the order canonical for easy comparison.
  newTransforms.sort((t1, t2) => TRANSFORMS.indexOf(t1) - TRANSFORMS.indexOf(t2));
  return newTransforms;
}

function removeTransform(transforms: Array<Transform>, transform: Transform): Array<Transform> {
  return transforms.filter((t) => t !== transform);
}

interface BooleanOptionProps {
  optionName:
    | "enableLegacyTypeScriptModuleInterop"
    | "enableLegacyBabel5ModuleInterop"
    | "production"
    | "disableESTransforms"
    | "keepUnusedImports"
    | "preserveDynamicImport"
    | "injectCreateRequireForImportRequire";
  options: HydratedOptions;
  onUpdateOptions: (options: HydratedOptions) => void;
}

function BooleanOption({optionName, options, onUpdateOptions}: BooleanOptionProps): JSX.Element {
  return (
    <CheckBox
      label={<span className={css(styles.optionName)}>{optionName}</span>}
      checked={options[optionName]}
      onChange={(checked) => {
        onUpdateOptions({...options, [optionName]: checked});
      }}
    />
  );
}

interface StringOptionProps {
  optionName: "jsxPragma" | "jsxFragmentPragma" | "jsxImportSource";
  options: HydratedOptions;
  onUpdateOptions: (options: HydratedOptions) => void;
  inputWidth: number;
}

function StringOption({
  optionName,
  options,
  onUpdateOptions,
  inputWidth,
}: StringOptionProps): JSX.Element {
  return (
    <div className={css(styles.option)}>
      {/* Include a hidden checkbox so the option name is vertically aligned
          with the boolean options. */}
      <input type="checkbox" className={css(styles.hiddenCheckbox)} />
      <span className={css(styles.optionName)}>
        {optionName}:{" "}
        <TextInput
          value={options[optionName]}
          onChange={(value) => {
            onUpdateOptions({...options, [optionName]: value});
          }}
          width={inputWidth}
        />
      </span>
    </div>
  );
}

interface JSXRuntimeOptionProps {
  options: HydratedOptions;
  onUpdateOptions: (options: HydratedOptions) => void;
}

function JSXRuntimeOption({options, onUpdateOptions}: JSXRuntimeOptionProps): JSX.Element {
  return (
    <div className={css(styles.option)}>
      {/* Include a hidden checkbox so the option name is vertically aligned
          with the boolean options. */}
      <input type="checkbox" className={css(styles.hiddenCheckbox)} />
      <span className={css(styles.optionName)}>
        jsxRuntime:{" "}
        <SimpleSelect
          options={["classic", "automatic", "preserve"]}
          value={options.jsxRuntime}
          onChange={(value) => {
            onUpdateOptions({...options, jsxRuntime: value});
          }}
        />
      </span>
    </div>
  );
}

export default function SucraseOptionsBox({
  options,
  onUpdateOptions,
}: SucraseOptionsBoxProps): JSX.Element {
  const [showSecondaryOptions, setShowSecondaryOptions] = useState(false);
  return (
    <OptionsBox>
      <div className={css(styles.container)}>
        <div className={css(styles.mainOptions)}>
          <span className={css(styles.title)}>Options</span>
          {TRANSFORMS.filter(
            (t) => showSecondaryOptions || ["jsx", "typescript", "flow", "imports"].includes(t),
          ).map((transformName) => (
            <CheckBox
              key={transformName}
              label={transformName}
              checked={options.transforms.includes(transformName)}
              onChange={(checked) => {
                let newTransforms = options.transforms;
                if (checked) {
                  // TypeScript and Flow are mutually exclusive, so enabling one disables the other.
                  if (transformName === "typescript") {
                    newTransforms = removeTransform(newTransforms, "flow");
                  } else if (transformName === "flow") {
                    newTransforms = removeTransform(newTransforms, "typescript");
                  }
                  newTransforms = addTransform(newTransforms, transformName);
                } else {
                  newTransforms = removeTransform(newTransforms, transformName);
                }
                onUpdateOptions({...options, transforms: newTransforms});
              }}
            />
          ))}
          <a
            href="#more"
            className={css(styles.link)}
            onClick={(e) => {
              setShowSecondaryOptions(!showSecondaryOptions);
              e.preventDefault();
            }}
          >
            {showSecondaryOptions ? "Collapse" : "More..."}
          </a>
        </div>
        {showSecondaryOptions && (
          <div className={css(styles.secondaryOptions)}>
            <div className={css(styles.secondaryOptionColumn)}>
              <BooleanOption
                optionName="disableESTransforms"
                options={options}
                onUpdateOptions={onUpdateOptions}
              />
              {options.transforms.includes("jsx") && (
                <>
                  <JSXRuntimeOption options={options} onUpdateOptions={onUpdateOptions} />
                  {options.jsxRuntime !== "preserve" && (
                    <BooleanOption
                      optionName="production"
                      options={options}
                      onUpdateOptions={onUpdateOptions}
                    />
                  )}
                  {options.jsxRuntime === "classic" && (
                    <>
                      <StringOption
                        optionName="jsxPragma"
                        options={options}
                        onUpdateOptions={onUpdateOptions}
                        inputWidth={182}
                      />
                      <StringOption
                        optionName="jsxFragmentPragma"
                        options={options}
                        onUpdateOptions={onUpdateOptions}
                        inputWidth={120}
                      />
                    </>
                  )}

                  {options.jsxRuntime === "automatic" && (
                    <StringOption
                      optionName="jsxImportSource"
                      options={options}
                      onUpdateOptions={onUpdateOptions}
                      inputWidth={116}
                    />
                  )}
                </>
              )}
            </div>
            <div className={css(styles.secondaryOptionColumn)}>
              {options.transforms.includes("typescript") && (
                <BooleanOption
                  optionName="keepUnusedImports"
                  options={options}
                  onUpdateOptions={onUpdateOptions}
                />
              )}
              {options.transforms.includes("imports") && (
                <>
                  <BooleanOption
                    optionName="preserveDynamicImport"
                    options={options}
                    onUpdateOptions={onUpdateOptions}
                  />
                  <BooleanOption
                    optionName="enableLegacyTypeScriptModuleInterop"
                    options={options}
                    onUpdateOptions={onUpdateOptions}
                  />
                  <BooleanOption
                    optionName="enableLegacyBabel5ModuleInterop"
                    options={options}
                    onUpdateOptions={onUpdateOptions}
                  />
                </>
              )}
              {!options.transforms.includes("imports") &&
                options.transforms.includes("typescript") && (
                  <BooleanOption
                    optionName="injectCreateRequireForImportRequire"
                    options={options}
                    onUpdateOptions={onUpdateOptions}
                  />
                )}
            </div>
          </div>
        )}
      </div>
    </OptionsBox>
  );
}

const styles = StyleSheet.create({
  container: {
    display: "flex",
    flexDirection: "column",
  },
  title: {
    fontSize: "1.2em",
    padding: 6,
  },
  mainOptions: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
  },
  link: {
    color: "#CCCCCC",
    marginLeft: 6,
    marginRight: 6,
  },
  secondaryOptions: {
    display: "flex",
    justifyContent: "space-around",
  },
  secondaryOptionColumn: {
    display: "flex",
    flexDirection: "column",
  },
  option: {
    marginLeft: 6,
    marginRight: 6,
    display: "flex",
  },
  hiddenCheckbox: {
    visibility: "hidden",
  },
  optionName: {
    fontFamily: "monospace",
  },
});
