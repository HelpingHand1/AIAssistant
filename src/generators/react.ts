import { registerGenerator } from './index';
import { AiResponse } from '../types';

// Log when this file is loaded
console.log("[react.ts] Loading React Component Generator...");

registerGenerator({
  name: 'React Component Generator',
  description: 'Generates React components and hooks',
  detect: (input: string): boolean => {
    const patterns = [
      /create\s+(?:a\s+)?react\s+component/i,
      /generate\s+(?:a\s+)?react\s+component/i,
      /(?:create|make|build)\s+(?:a\s+)?(?:new\s+)?component/i
    ];
    return patterns.some(pattern => pattern.test(input));
  },
  generate: async (input: string): Promise<AiResponse> => {
    // Log the input received
    console.log("[react.ts] generate() called with input:", input);

    return {
      message: "React component creation successful!",
      actions: [
        {
          type: 'createFolder',
          path: 'src/components'
        },
        {
          type: 'createFile',
          path: 'src/components/MyComponent.tsx',
          content: `import React, { useState, useEffect } from 'react';

interface MyComponentProps {
  title?: string;
  onAction?: () => void;
}

const MyComponent: React.FC<MyComponentProps> = ({
  title = 'Default Title',
  onAction
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log('[MyComponent] useEffect called, setting document title:', title);
    document.title = title;
  }, [title]);

  const handleClick = () => {
    console.log('[MyComponent] handleClick called, incrementing count...');
    setCount(prev => prev + 1);
    if (onAction) {
      console.log('[MyComponent] onAction exists, calling onAction...');
      onAction();
    }
  };

  console.log('[MyComponent] Rendering MyComponent with title:', title);

  return (
    <div className="my-component">
      <h2>{title}</h2>
      <p>Count: {count}</p>
      <button onClick={handleClick}>Increment</button>
    </div>
  );
};

export default MyComponent;
`
        }
      ]
    };
  }
});